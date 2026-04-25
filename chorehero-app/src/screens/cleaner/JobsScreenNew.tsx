/**
 * JobsScreen - Refactored with Zustand store and shared components
 * 
 * Features:
 * - Available / Active / History tabs
 * - Filter pills (All Jobs / Today / Tomorrow / This Week)
 * - JobCard component for consistent styling
 * - Pull-to-refresh
 * - Real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { cleanerBookingService } from '../../services/cleanerBookingService';
import { jobQuoteService, type Job, type Quote } from '../../services/jobQuoteService';
import { supabase } from '../../services/supabase';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

// Store
import { useCleanerStore, selectFilteredBookings } from '../../store/cleanerStore';

// Components
import { Chip, JobCard } from '../../components/cleaner';
import { SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';

// Theme
import { cleanerTheme } from '../../utils/theme';

// Types
import type { Booking, JobFilter, JobTab } from '../../types/cleaner';
import { wp, hp } from '../../utils/responsive';
import { getProAccessInstructionsLine } from '../../utils/bookingAccessDisplay';
import { ensureForegroundLocationForProTracking } from '../../utils/proTrackingLocation';
import { shouldShowTodaysJobCallout } from '../../utils/cleanerJobsTabUi';
import { resolveQuoteJobIdForBooking } from '../../utils/resolveQuoteJobId';

const { colors, typography, spacing, radii, shadows } = cleanerTheme;
const BRAND_ORANGE = colors.primary;

type StackParamList = {
  JobsScreen: undefined;
  Jobs: { initialTab?: string };
  JobDetails: { jobId: string };
  QuoteJobDetail: { jobId: string };
  QuoteList: { jobId: string; viewerRole?: 'customer' | 'pro' };
  ChatScreen: { bookingId: string; otherParticipant: any };
  Profile: undefined;
};

type JobsScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'JobsScreen'>;
  route?: { params?: { initialTab?: string } };
};

const TABS: { key: JobTab; label: string }[] = [
  { key: 'available', label: 'Requests' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'active', label: 'Booked' },
  { key: 'history', label: 'History' },
];

type AvailableItem = { type: 'quoteJob'; data: Job } | { type: 'booking'; data: Booking };
type MyQuoteItem = { type: 'myQuote'; data: Quote & { job?: Job } };

const JobsScreenNew: React.FC<JobsScreenProps> = ({ navigation, route }) => {
  const { showToast } = useToast();
  const { user } = useAuth();

  // Local state - honor initialTab from navigation params when navigating from Dashboard/QuoteSent
  const [activeTab, setActiveTab] = useState<JobTab>('available');
  const [quoteJobs, setQuoteJobs] = useState<Job[]>([]);
  const [quoteJobsLoading, setQuoteJobsLoading] = useState(false);
  const [myQuotes, setMyQuotes] = useState<(Quote & { job?: Job })[]>([]);
  const [myQuotesLoading, setMyQuotesLoading] = useState(false);

  useEffect(() => {
    const tab = route?.params?.initialTab;
    if (tab === 'available' || tab === 'quotes' || tab === 'active' || tab === 'history') {
      setActiveTab(tab);
    }
  }, [route?.params?.initialTab]);

  // Store state
  const {
    currentCleaner,
    availableBookings,
    activeBookings,
    pastBookings,
    isLoading,
    isRefreshing,
    fetchDashboard,
    acceptBooking,
    declineBooking,
    startTraveling,
    markInProgress,
    markCompleted,
    refreshData,
    removeCancelledBooking,
  } = useCleanerStore();

  /**
   * Cleaners can't accept jobs until both their profile is complete AND they
   * have toggled themselves online. Until then, hide every job list and show
   * a single "finish setup" CTA so the screen isn't a confusing dead end.
   */
  const profileCompletion = currentCleaner?.profileCompletion ?? 0;
  const isAvailableForJobs = !!currentCleaner?.isOnline;
  const profileGateActive =
    !!currentCleaner && (profileCompletion < 0.999 || !isAvailableForJobs);

  // Local state
  const [selectedFilter] = useState<JobFilter>('all');
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);
  const [capacityLimit, setCapacityLimit] = useState<number>(3);

  const fetchQuoteJobs = useCallback(async () => {
    const proId = user?.id;
    if (!proId || proId.startsWith('demo_')) return;
    setQuoteJobsLoading(true);
    try {
      const { data: profile } = await supabase
        .from('cleaner_profiles')
        .select('service_radius_km, specialties')
        .eq('user_id', proId)
        .single();
      const radiusMiles = profile?.service_radius_km != null
        ? Math.round(profile.service_radius_km * 0.621371)
        : 50;
      const firstSpecialty = profile?.specialties?.[0];
      const proCategory = firstSpecialty
        ? jobQuoteService.specialtyToCategory(firstSpecialty)
        : undefined;

      let proLat: number | undefined;
      let proLng: number | undefined;
      const { data: addr } = await supabase
        .from('addresses')
        .select('latitude, longitude')
        .eq('user_id', proId)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('is_default', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (addr?.latitude != null && addr?.longitude != null) {
        proLat = Number(addr.latitude);
        proLng = Number(addr.longitude);
      }

      const res = await jobQuoteService.getAvailableJobsForPro(
        proId,
        proLat,
        proLng,
        proCategory ?? undefined,
        radiusMiles
      );
      if (res.success && res.data) setQuoteJobs(res.data);
      else setQuoteJobs([]);
    } catch {
      setQuoteJobs([]);
    } finally {
      setQuoteJobsLoading(false);
    }
  }, [user?.id]);

  const fetchMyQuotes = useCallback(async () => {
    const proId = user?.id;
    if (!proId || proId.startsWith('demo_')) return;
    setMyQuotesLoading(true);
    try {
      const res = await jobQuoteService.getProQuotes(proId);
      if (res.success && res.data) setMyQuotes(res.data);
      else setMyQuotes([]);
    } catch {
      setMyQuotes([]);
    } finally {
      setMyQuotesLoading(false);
    }
  }, [user?.id]);

  // Load data on mount
  useEffect(() => {
    fetchDashboard();
  }, []);

  // Realtime: when customer cancels, remove from pro's active jobs
  useEffect(() => {
    const proId = user?.id;
    if (!proId || proId.startsWith('demo_')) return;
    const channel = supabase
      .channel('bookings-cancelled')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `cleaner_id=eq.${proId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          if (newStatus === 'cancelled') {
            removeCancelledBooking(payload.new.id);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, removeCancelledBooking]);

  // Fetch capacity limit for badge
  useEffect(() => {
    const proId = user?.id;
    if (!proId || proId.startsWith('demo_')) return;
    supabase
      .from('cleaner_profiles')
      .select('max_concurrent_bookings')
      .eq('user_id', proId)
      .single()
      .then(({ data }) => {
        if (data?.max_concurrent_bookings != null) {
          setCapacityLimit(data.max_concurrent_bookings);
        }
      });
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'available') fetchQuoteJobs();
    if (activeTab === 'quotes') fetchMyQuotes();
  }, [activeTab, fetchQuoteJobs, fetchMyQuotes]);

  // Real-time subscription for new marketplace jobs (pending)
  useEffect(() => {
    const cleanerId = user?.id;
    if (!cleanerId || cleanerId.startsWith('demo_')) return;

    const unsub1 = cleanerBookingService.subscribeToNewBookings(
      cleanerId,
      () => {
        fetchDashboard();
        showToast?.({ type: 'info', message: 'New job available!' });
      }
    );

    // Real-time subscription for quote-accepted bookings (assigned to this cleaner)
    const unsub2 = cleanerBookingService.subscribeToNewAssignedBookings(
      cleanerId,
      () => {
        fetchDashboard();
        showToast?.({ type: 'success', message: 'Quote accepted! New booking in Booked tab.' });
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [user?.id]);

  // Refresh when screen comes into focus (e.g. after customer pays for quote)
  useFocusEffect(
    useCallback(() => {
      if (user?.id && !user.id.startsWith('demo_')) {
        fetchDashboard();
      }
    }, [user?.id])
  );

  // Get bookings based on active tab
  const getBookingsForTab = useCallback((): Booking[] => {
    switch (activeTab) {
      case 'available':
        return selectFilteredBookings(availableBookings, selectedFilter);
      case 'quotes':
        return [];
      case 'active':
        return activeBookings;
      case 'history':
        return pastBookings;
      default:
        return [];
    }
  }, [activeTab, availableBookings, activeBookings, pastBookings, selectedFilter]);

  const bookings = getBookingsForTab();

  // Combined list for available tab: quote jobs first, then legacy bookings
  const availableItems: AvailableItem[] =
    activeTab === 'available'
      ? [
          ...quoteJobs.map((j) => ({ type: 'quoteJob' as const, data: j })),
          ...bookings.map((b) => ({ type: 'booking' as const, data: b })),
        ]
      : activeTab === 'active' || activeTab === 'history'
        ? bookings.map((b) => ({ type: 'booking' as const, data: b }))
        : [];

  // My Quotes tab: list of quote cards (exclude accepted - those move to Booked)
  const myQuoteItems: MyQuoteItem[] =
    activeTab === 'quotes'
      ? myQuotes
          .filter((q) => q.status !== 'accepted')
          .map((q) => ({ type: 'myQuote' as const, data: q }))
      : [];

  // FlatList data: quotes tab uses myQuoteItems, others use availableItems
  const listData = activeTab === 'quotes' ? myQuoteItems : availableItems;

  const handleRefresh = useCallback(async () => {
    await refreshData();
    if (activeTab === 'available') await fetchQuoteJobs();
    if (activeTab === 'quotes') await fetchMyQuotes();
  }, [refreshData, fetchQuoteJobs, fetchMyQuotes, activeTab]);
  const todayActive = activeBookings.find((booking) => {
    const date = new Date(booking.scheduledAt);
    const now = new Date();
    return date.toDateString() === now.toDateString();
  });

  // Handlers
  const handleAcceptJob = async (bookingId: string) => {
    setAcceptingJobId(bookingId);
    try {
      await acceptBooking(bookingId);
      showToast?.({ 
        type: 'success', 
        message: 'Job accepted! It\'s now in Active jobs.' 
      });
      setActiveTab('active'); // Switch to active tab
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to accept job';
      showToast?.({ type: 'error', message: msg });
    } finally {
      setAcceptingJobId(null);
    }
  };

  const handleDeclineJob = (bookingId: string) => {
    Alert.alert(
      'Decline Job',
      'Are you sure you want to decline this job opportunity?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await declineBooking(bookingId);
              showToast?.({ type: 'info', message: 'Job declined' });
            } catch (error) {
              showToast?.({ type: 'error', message: 'Failed to decline job' });
            }
          },
        },
      ]
    );
  };

  const handleStartTraveling = async (bookingId: string) => {
    const locOk = await ensureForegroundLocationForProTracking();
    if (!locOk) {
      showToast?.({
        type: 'info',
        message: 'Turn on location permission to share your trip with the customer.',
      });
      throw new Error('location_unavailable');
    }
    try {
      await startTraveling(bookingId);
      showToast?.({ type: 'success', message: 'On the way — customer can follow your trip.' });
    } catch (error) {
      showToast?.({ type: 'error', message: 'Failed to start heading. Try again.' });
      throw error;
    }
  };

  const handleMarkArrived = async (bookingId: string) => {
    try {
      const ok = await cleanerBookingService.updateBookingStatus(bookingId, 'cleaner_arrived');
      if (ok) {
        await refreshData();
        showToast?.({ type: 'success', message: "You've arrived!" });
      } else {
        showToast?.({ type: 'error', message: 'Failed to update status' });
      }
    } catch (error) {
      showToast?.({ type: 'error', message: 'Failed to update status' });
    }
  };

  const handleMarkComplete = async (bookingId: string) => {
    try {
      await markCompleted(bookingId);
      showToast?.({ type: 'success', message: 'Job completed!' });
    } catch (error) {
      showToast?.({ type: 'error', message: 'Failed to complete job' });
    }
  };

  const handleStartJob = async (bookingId: string) => {
    try {
      await markInProgress(bookingId);
      await refreshData();
      showToast?.({ type: 'success', message: 'Job started!' });
    } catch (error) {
      showToast?.({ type: 'error', message: 'Failed to start job' });
    }
  };

  const handleJobPress = (booking: Booking) => {
    navigation.navigate('JobDetails', { jobId: booking.id });
  };

  const openTodaysJobQuoteContext = useCallback(() => {
    if (!todayActive) return;
    const jid = resolveQuoteJobIdForBooking(todayActive);
    if (jid) {
      navigation.navigate('QuoteList', { jobId: jid, viewerRole: 'pro' });
      return;
    }
    showToast?.({
      type: 'info',
      message: 'No linked quote job for this booking. Opening job details.',
    });
    navigation.navigate('JobDetails', { jobId: todayActive.id });
  }, [todayActive, navigation, showToast]);

  const handleQuoteJobPress = (job: Job) => {
    (navigation as any).navigate('QuoteJobDetail', { jobId: job.id });
  };

  const handleWithdrawQuote = (q: Quote & { job?: Job }) => {
    Alert.alert(
      'Withdraw Quote',
      'Are you sure? Customer will no longer see this quote.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            const res = await jobQuoteService.withdrawQuote(q.id, user?.id ?? '');
            if (res.success) {
              setMyQuotes((prev) => prev.filter((x) => x.id !== q.id));
              showToast?.({ type: 'info', message: 'Quote withdrawn' });
            } else {
              showToast?.({ type: 'error', message: res.error ?? 'Failed to withdraw' });
            }
          },
        },
      ]
    );
  };

  const handleEditQuotePress = (q: Quote & { job?: Job }) => {
    (navigation as any).navigate('QuoteJobDetail', { jobId: q.job_id });
  };

  const getQuoteStatusStyle = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    if (status === 'accepted') return { bg: colors.success, label: 'Accepted', textColor: colors.textInverse };
    if (status === 'declined') return { bg: colors.borderLight, label: 'Declined', textColor: colors.textSecondary };
    if (status === 'withdrawn') return { bg: colors.borderLight, label: 'Withdrawn', textColor: colors.textSecondary };
    if (status === 'expired' || isExpired) return { bg: colors.borderLight, label: 'Expired', textColor: colors.textSecondary };
    if (status === 'viewed') return { bg: colors.primaryLight, label: 'Viewed', textColor: colors.primary };
    return { bg: colors.specialRequestBg, label: 'Pending', textColor: BRAND_ORANGE };
  };

  const canEditQuote = (q: Quote & { job?: Job }) =>
    q.status === 'pending' && !q.customer_viewed_at;

  // Render tab bar
  const renderTabBar = () => (
    <View style={styles.tabScroll}>
      <View style={styles.tabContainer}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count =
            tab.key === 'available'
              ? quoteJobs.length + availableBookings.length
              : tab.key === 'quotes'
                ? myQuotes.length
                : tab.key === 'active'
                  ? activeBookings.length
                  : pastBookings.length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]} numberOfLines={1}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{count > 9 ? '9+' : count}</Text>
                </View>
              )}
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // Render filter bar (only for available tab)
  const renderFilterBar = () => null;

  const renderQuoteJobCard = (job: Job) => (
    <TouchableOpacity
      style={styles.quoteJobCard}
      onPress={() => handleQuoteJobPress(job)}
      activeOpacity={0.85}
    >
      <View style={styles.quoteJobCardLeft}>
        <View style={styles.quoteJobCardIcon}>
          <Ionicons name="videocam" size={22} color={BRAND_ORANGE} />
        </View>
        <View style={styles.quoteJobCardContent}>
          <Text style={styles.quoteJobCardHeadline} numberOfLines={2}>
            {jobQuoteService.getJobDisplayTitle(job)}
          </Text>
          <View style={styles.quoteJobCardMeta}>
            <Text style={styles.quoteJobCardCategory}>
              {jobQuoteService.getCategoryLabel(job.category)}
            </Text>
            {job.distance_miles != null && (
              <Text style={styles.quoteJobCardDistance}>
                {job.distance_miles} mi away
              </Text>
            )}
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderMyQuoteCard = (q: Quote & { job?: Job }) => {
    const job = q.job;
    const { bg, label, textColor } = getQuoteStatusStyle(q.status, q.expires_at);
    const expired = new Date(q.expires_at) < new Date();
    return (
      <TouchableOpacity
        style={styles.myQuoteCard}
        onPress={() => (navigation as any).navigate('QuoteJobDetail', { jobId: q.job_id })}
        activeOpacity={0.9}
      >
        <Text style={styles.myQuoteHeadlineLarge} numberOfLines={2}>
          {jobQuoteService.getJobDisplayTitle(job)}
        </Text>
        <Text style={styles.myQuotePriceGreen}>${(q.price_cents / 100).toFixed(0)}</Text>
        <View style={[styles.myQuoteStatusBadge, { backgroundColor: bg }]}>
          <Text style={[styles.myQuoteStatusText, { color: textColor }]}>{label}</Text>
        </View>
        <Text style={styles.myQuoteDateSmall}>
          Sent {new Date(q.created_at).toLocaleDateString()}
        </Text>
        <View style={styles.myQuoteActions}>
          {canEditQuote(q) && (
            <TouchableOpacity
              style={styles.myQuoteEditBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleEditQuotePress(q);
              }}
            >
              <Ionicons name="pencil" size={14} color={BRAND_ORANGE} />
              <Text style={styles.myQuoteEditBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
          {['pending', 'viewed'].includes(q.status) && !expired && (
            <TouchableOpacity
              style={styles.myQuoteWithdrawBtn}
              onPress={(e) => {
                e.stopPropagation();
                handleWithdrawQuote(q);
              }}
            >
              <Text style={styles.myQuoteWithdrawBtnText}>Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render job card (booking or quote job)
  const renderItem = ({ item, index }: { item: AvailableItem | MyQuoteItem; index: number }) => {
    if (item.type === 'myQuote') {
      return (
        <View style={styles.jobCardWrapper}>
          {renderMyQuoteCard(item.data)}
        </View>
      );
    }
    if (item.type === 'quoteJob') {
      return (
        <View style={styles.jobCardWrapper}>
          <View style={styles.quoteJobBadge}>
            <Ionicons name="videocam" size={10} color={colors.textInverse} />
            <Text style={styles.quoteJobBadgeText}>Video Quote</Text>
          </View>
          {renderQuoteJobCard(item.data)}
        </View>
      );
    }
    const booking = item.data;
    const showEmergencyTag =
      activeTab === 'available' &&
      (booking.isInstant || booking.serviceType.toLowerCase().includes('emergency'));
    const cardVariant =
      activeTab === 'history' ? 'history' : activeTab === 'active' ? 'active' : 'available';
    return (
      <View style={styles.jobCardWrapper}>
        {showEmergencyTag && (
          <View style={styles.emergencyTag}>
            <Ionicons name="flash" size={12} color={colors.textInverse} />
            <Text style={styles.emergencyTagText}>Emergency Clean</Text>
          </View>
        )}
        <JobCard
          booking={booking}
          variant={cardVariant}
          onPress={() => handleJobPress(booking)}
          onAccept={() => handleAcceptJob(booking.id)}
          onDecline={() => handleDeclineJob(booking.id)}
          onStartTraveling={() => handleStartTraveling(booking.id)}
          onMarkArrived={() => handleMarkArrived(booking.id)}
          onStartJob={() => handleStartJob(booking.id)}
          onMarkComplete={() => handleMarkComplete(booking.id)}
          onOpenLiveMap={
            activeTab === 'active'
              ? () => (navigation as any).navigate('LiveTracking', { bookingId: booking.id })
              : undefined
          }
          isAccepting={acceptingJobId === booking.id}
          delay={index * 50}
        />
      </View>
    );
  };

  // Render empty state (special onboarding flow for available tab when empty)
  const renderEmptyState = () => {
    const isAvailableEmpty =
      activeTab === 'available' && quoteJobs.length === 0 && availableBookings.length === 0;
    const isQuotesEmpty = activeTab === 'quotes' && myQuoteItems.length === 0;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons 
            name={activeTab === 'available' ? 'briefcase-outline' : 
                  activeTab === 'quotes' ? 'videocam-outline' :
                  activeTab === 'active' ? 'time-outline' : 'checkmark-done-outline'} 
            size={26} 
            color={BRAND_ORANGE} 
          />
        </View>
        <Text style={styles.emptyTitle}>
          {isAvailableEmpty
            ? "You're all set!"
            : isQuotesEmpty
              ? 'No active quotes'
              : activeTab === 'available' 
                ? 'No jobs available' 
                : activeTab === 'active' 
                  ? 'No active jobs' 
                  : 'No completed jobs'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {isAvailableEmpty
            ? "New jobs will appear here. Complete your profile to get notified first."
            : isQuotesEmpty
              ? 'Browse jobs to send quotes!'
              : activeTab === 'available' 
                ? 'New job opportunities will appear here' 
                : activeTab === 'active' 
                  ? 'Accept a job to see it here' 
                  : 'Your completed jobs will appear here'}
        </Text>
        {(isAvailableEmpty || isQuotesEmpty) && (
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.emptyPrimaryButton}
              onPress={() => (isQuotesEmpty ? setActiveTab('available') : refreshData())}
              disabled={isRefreshing}
              activeOpacity={0.8}
            >
            <Ionicons name={isQuotesEmpty ? 'briefcase-outline' : 'refresh'} size={20} color={colors.textInverse} />
              <Text style={styles.emptyPrimaryButtonText}>
                {isQuotesEmpty ? 'Browse Requests' : isRefreshing ? 'Refreshing...' : 'Refresh Jobs'}
              </Text>
            </TouchableOpacity>
            {isAvailableEmpty && (
              <TouchableOpacity
                style={styles.emptySecondaryButton}
                onPress={() => (navigation as any).navigate('Profile')}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={18} color={BRAND_ORANGE} />
                <Text style={styles.emptySecondaryButtonText}>Complete Profile</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs</Text>
        {quoteJobs.length + availableBookings.length > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {quoteJobs.length + availableBookings.length} new
            </Text>
          </View>
        )}
      </View>

      {/* Tab Bar */}
      {renderTabBar()}

      {profileGateActive ? (
        <View style={styles.gateContainer}>
          <View style={styles.gateIconWrap}>
            <Ionicons name="shield-checkmark" size={32} color={BRAND_ORANGE} />
          </View>
          <Text style={styles.gateTitle}>
            {profileCompletion < 0.999 ? 'Finish your profile to see jobs' : 'Go online to start receiving jobs'}
          </Text>
          <Text style={styles.gateSubtitle}>
            {profileCompletion < 0.999
              ? 'Complete your bio, service area, rate, and verification so customers can trust your work and pros around you can take requests.'
              : 'You\'re fully set up. Toggle yourself online from the Profile tab and we\'ll start sending jobs your way.'}
          </Text>
          <TouchableOpacity
            style={styles.gateButton}
            onPress={() => (navigation as any).navigate('Profile')}
            activeOpacity={0.85}
          >
            <Ionicons
              name={profileCompletion < 0.999 ? 'arrow-forward-circle' : 'power'}
              size={18}
              color={colors.textInverse}
            />
            <Text style={styles.gateButtonText}>
              {profileCompletion < 0.999 ? 'Continue setup' : 'Go to Profile'}
            </Text>
          </TouchableOpacity>
          {profileCompletion < 0.999 ? (
            <Text style={styles.gateMeta}>{Math.round(profileCompletion * 100)}% complete</Text>
          ) : null}
        </View>
      ) : (
        <>
          {/* Filter Bar */}
          {renderFilterBar()}

          {shouldShowTodaysJobCallout(activeTab) && todayActive && (
        <TouchableOpacity
          style={styles.activeJobCard}
          onPress={openTodaysJobQuoteContext}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="View todays job and quotes"
        >
          <View style={styles.todaysJobCardHeader}>
            <Text style={styles.activeJobTitle}>Today’s job</Text>
            <Ionicons name="chevron-forward" size={22} color={BRAND_ORANGE} />
          </View>
          <Text style={styles.tapToViewHint}>Tap to open this job and its video quotes (same as the customer’s quote screen)</Text>
          <Text style={styles.activeJobName}>{todayActive.customerName}</Text>
          {!!todayActive.serviceType?.trim() && (
            <Text style={styles.activeJobServiceTitle} numberOfLines={2}>
              {todayActive.serviceType}
            </Text>
          )}
          <Text style={styles.activeJobMeta}>Access</Text>
          <Text style={styles.activeJobInstructions}>
            {getProAccessInstructionsLine(todayActive)}
          </Text>
        </TouchableOpacity>
      )}

      {/* Job List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SkeletonList count={3} />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) =>
            item.type === 'myQuote'
              ? `myquote-${item.data.id}`
              : item.type === 'quoteJob'
                ? `quote-${item.data.id}`
                : item.data.id
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing || quoteJobsLoading || myQuotesLoading}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Profile-completion gate (replaces all job lists when the cleaner isn't
  // yet ready to take work). Keeps the screen purposeful instead of showing
  // empty placeholders that look broken.
  gateContainer: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.cardBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 47, 0.45)',
    alignItems: 'center',
  },
  gateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 165, 47, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  gateTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  gateSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  gateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
  },
  gateButtonText: {
    color: colors.textInverse,
    fontWeight: '700',
    fontSize: 14,
  },
  gateMeta: {
    marginTop: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  capacityBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  capacityBadgeFull: { backgroundColor: colors.errorLight },
  capacityBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('1.5%'),
    paddingBottom: hp('1.2%'),
  },
  headerTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textPrimary,
  },
  headerBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  headerBadgeText: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: typography.label.fontWeight,
    color: BRAND_ORANGE,
  },
  activeJobCard: {
    backgroundColor: colors.cardBg,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    ...shadows.soft,
  },
  todaysJobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('0.4%'),
  },
  activeJobTitle: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    color: BRAND_ORANGE,
  },
  tapToViewHint: {
    fontSize: typography.caption?.fontSize ?? 12,
    color: colors.textMuted,
    marginBottom: hp('0.8%'),
  },
  activeJobName: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textPrimary,
    marginBottom: hp('0.5%'),
  },
  activeJobServiceTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: hp('1%'),
  },
  activeJobMeta: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: '600',
    color: colors.textMuted,
  },
  activeJobInstructions: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginTop: hp('0.7%'),
  },
  tabScroll: {
    marginBottom: hp('1%'),
    paddingHorizontal: wp('5%'),
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('1.2%'),
    paddingHorizontal: wp('2%'),
    borderRadius: 10,
    gap: 6,
    position: 'relative',
  },
  activeTab: {
    backgroundColor: colors.primaryLight,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: -2,
    left: '22%',
    right: '22%',
    height: 3,
    backgroundColor: BRAND_ORANGE,
    borderRadius: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: BRAND_ORANGE,
    fontWeight: '700',
  },
  tabBadge: {
    backgroundColor: BRAND_ORANGE,
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120, // Account for bottom nav
  },
  jobCardWrapper: {
    marginBottom: spacing.md,
  },
  emergencyTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
    backgroundColor: colors.error,
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.7%'),
    borderRadius: wp('3%'),
    marginBottom: hp('1%'),
  },
  emergencyTagText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
  },
  quoteJobBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
    backgroundColor: BRAND_ORANGE,
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('0.7%'),
    borderRadius: wp('3%'),
    marginBottom: hp('1%'),
  },
  quoteJobBadgeText: {
    color: colors.textInverse,
    fontSize: 11,
    fontWeight: '700',
  },
  quoteJobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  quoteJobCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quoteJobCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quoteJobCardContent: {
    flex: 1,
  },
  quoteJobCardHeadline: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  quoteJobCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  quoteJobCardCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  quoteJobCardDistance: {
    fontSize: 12,
    color: BRAND_ORANGE,
    fontWeight: '600',
  },
  myQuoteCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  myQuoteHeadlineLarge: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  myQuoteHeadline: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  myQuotePriceGreen: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND_ORANGE,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  myQuotePrice: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND_ORANGE,
    marginBottom: 8,
  },
  myQuoteStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  myQuoteStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textInverse,
  },
  myQuoteDateSmall: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 8,
  },
  myQuoteDate: {
    fontSize: typography.labelSmall.fontSize,
    color: colors.textMuted,
    marginBottom: hp('1.2%'),
  },
  myQuoteActions: {
    flexDirection: 'row',
    gap: wp('2%'),
    flexWrap: 'wrap',
  },
  myQuoteEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: hp('0.8%'),
    paddingHorizontal: wp('3%'),
    borderRadius: wp('2%'),
    borderWidth: 1,
    borderColor: BRAND_ORANGE,
  },
  myQuoteEditBtnText: {
    fontSize: typography.labelSmall.fontSize,
    fontWeight: '600',
    color: BRAND_ORANGE,
  },
  myQuoteWithdrawBtn: {
    paddingVertical: hp('0.8%'),
    paddingHorizontal: wp('3%'),
  },
  myQuoteWithdrawBtnText: {
    fontSize: typography.labelSmall.fontSize,
    color: colors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    maxWidth: 280,
  },
  emptyActions: {
    width: '100%',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  emptyPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    backgroundColor: BRAND_ORANGE,
    paddingVertical: hp('1.8%'),
    borderRadius: radii.pill,
  },
  emptyPrimaryButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    color: colors.textInverse,
  },
  emptySecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    borderWidth: 2,
    borderColor: BRAND_ORANGE,
    paddingVertical: hp('1.5%'),
    borderRadius: radii.pill,
  },
  emptySecondaryButtonText: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    color: BRAND_ORANGE,
  },
});

export default JobsScreenNew;

