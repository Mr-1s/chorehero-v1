import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Animated,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { SkeletonBlock, SkeletonList } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { COLORS } from '../../utils/constants';

import { notificationService } from '../../services/notificationService';
import { jobService, type JobServiceResponse } from '../../services/jobService';
import { jobQuoteService, type Job as BoardJob } from '../../services/jobQuoteService';
import NetworkStatusIndicator from '../../components/NetworkStatusIndicator';
import { supabase } from '../../services/supabase';
import { cleanerBookingService } from '../../services/cleanerBookingService';
import { wp, hp } from '../../utils/responsive';
import { useCleanerStore } from '../../store/cleanerStore';
import { cleanerTheme } from '../../utils/theme';
import {
  getProfileCompletionFields,
  getNextCleanerCompletionNavTarget,
  mergeUserForProfileCompletion,
  type ProfileCompletionField,
} from '../../utils/cleanerProfileCompletion';

const { width } = Dimensions.get('window');
const { shadows } = cleanerTheme;
/** Pro / seller accent — align with bottom nav active (orange), not customer teal. */
const BRAND = cleanerTheme.colors.primary;
const BRAND_GRADIENT_END = cleanerTheme.colors.primaryDark;
const UI = {
  bg: COLORS.background,
  surface: COLORS.surface,
  border: COLORS.border,
  borderSoft: COLORS.borderSoft,
  textPrimary: COLORS.text.primary,
  textSecondary: COLORS.text.secondary,
  textMuted: COLORS.text.muted,
  textInverse: COLORS.text.inverse,
  primary: BRAND,
  success: COLORS.success,
  warning: COLORS.warning,
  error: COLORS.error,
  info: COLORS.info,
};
const STATS_GRADIENT_END = cleanerTheme.colors.primaryLight;

const profileCompletionDismissedKey = (uid: string) => `@chore:profile_checklist_dismissed:${uid}`;
/** Survives screen remount / tab change until AsyncStorage write completes. */
const sessionProfileChecklistDismissed = new Set<string>();

type StackParamList = {
  Dashboard: undefined;
  Jobs: undefined;
  Earnings: undefined;
  Schedule: undefined;
  ChatScreen: { bookingId: string; otherParticipant: any };
  UnifiedBooking: { serviceId?: string; serviceName?: string; basePrice?: number; duration?: number };
  Profile: undefined;
  Content: undefined;
  CleanerProfileEdit: undefined;
  VideoUpload: undefined;
  Tips: undefined;
  NotificationsScreen: undefined;
  IndividualChat: { bookingId: string; otherParticipant: { id: string; name: string; avatar_url: string; role: string } };
  JobDetails: { jobId: string };
  QuoteJobDetail: { jobId: string };
  EditProfileScreen: undefined;
  SettingsScreen: undefined;
};

type CleanerDashboardProps = {
  navigation: StackNavigationProp<StackParamList, 'Dashboard'>;
};

interface JobOpportunity {
  id: string;
  customer_name: string;
  customer_avatar: string;
  service_type: string;
  address: string;
  distance: number;
  estimated_duration: number;
  payment: number;
  scheduled_time: string;
  priority: 'high' | 'medium' | 'low';
  isAccepting?: boolean; // Loading state for job acceptance
}

interface ActiveJob {
  id: string;
  customer_name: string;
  customer_avatar: string;
  service_type: string;
  address: string;
  status: 'confirmed' | 'en_route' | 'arrived' | 'in_progress';
  scheduled_time: string;
  payment: number;
}

const CleanerDashboardScreen: React.FC<CleanerDashboardProps> = ({ navigation }) => {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [rating, setRating] = useState(0);
  const [jobOpportunities, setJobOpportunities] = useState<JobOpportunity[]>([]);
  const [quoteJobPreview, setQuoteJobPreview] = useState<BoardJob[]>([]);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [useDemoData] = useState(false);
  const [completionFields, setCompletionFields] = useState<ProfileCompletionField[]>([]);
  const [profileCardDismissed, setProfileCardDismissed] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [weeklyGoal, setWeeklyGoal] = useState(400);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  
  // Animation refs for micro-interactions
  const notificationPulse = useRef(new Animated.Value(1)).current;
  const badgeShimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    loadDashboardData();
    loadNotificationCount();
    startNotificationAnimation();
  }, [useDemoData]);

  /** Load dismissed flag; merge so we do not re-show the card if storage lags a fresh dismiss. */
  const applyProfileDismissedFromStorage = useCallback((uid: string) => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(profileCompletionDismissedKey(uid));
        setProfileCardDismissed((prev) => {
          if (v === '1' || sessionProfileChecklistDismissed.has(uid)) return true;
          if (v == null && prev) return true;
          return false;
        });
      } catch {
        setProfileCardDismissed((prev) => prev);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (isAuthLoading) return;
    if (!isAuthenticated) {
      setProfileCardDismissed(false);
      return;
    }
    const uid = user?.id;
    if (!uid || uid.startsWith('demo_')) {
      setProfileCardDismissed(false);
      return;
    }
    (async () => {
      try {
        const v = await AsyncStorage.getItem(profileCompletionDismissedKey(uid));
        if (cancelled) return;
        setProfileCardDismissed((prev) => {
          if (v === '1' || sessionProfileChecklistDismissed.has(uid)) return true;
          if (v == null && prev) return true;
          return false;
        });
      } catch {
        if (!cancelled) {
          setProfileCardDismissed((prev) => prev);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (!user?.id) {
      sessionProfileChecklistDismissed.clear();
    }
  }, [user?.id]);

  useFocusEffect(
    React.useCallback(() => {
      const uid = user?.id;
      if (uid && !uid.startsWith('demo_') && isAuthenticated) {
        if (sessionProfileChecklistDismissed.has(uid)) {
          setProfileCardDismissed(true);
        }
        applyProfileDismissedFromStorage(uid);
      }
      void loadDashboardData();
      void loadNotificationCount();
    }, [user?.id, useDemoData, isAuthenticated, applyProfileDismissedFromStorage])
  );

  // Realtime: when customer cancels, refresh dashboard so job disappears
  useEffect(() => {
    const proId = user?.id;
    if (!proId || proId.startsWith('demo_')) return;
    const channel = supabase
      .channel('dashboard-bookings-cancelled')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `cleaner_id=eq.${proId}`,
        },
        (payload) => {
          if (payload.new?.status === 'cancelled') {
            loadDashboardData();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Start notification pulse animation
  const startNotificationAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(notificationPulse, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(notificationPulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Badge shimmer animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(badgeShimmer, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(badgeShimmer, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadNotificationCount = async () => {
    if (user?.id) {
      const count = await notificationService.getUnreadCount(user.id);
      setNotificationCount(count);
    }
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) {
        setTodayEarnings(0);
        setWeeklyEarnings(0);
        setCompletedJobs(0);
        setRating(0);
        setJobOpportunities([]);
        setQuoteJobPreview([]);
        setActiveJob(null);
        setCompletionFields([]);
        return;
      }

      console.log('📊 Loading cleaner dashboard for:', user.id);

      await useCleanerStore.getState().fetchDashboard();
      const c = useCleanerStore.getState().currentCleaner;
      let todayTotal = c?.todayEarnings ?? 0;
      let weekTotal = c?.weeklyEarnings ?? 0;
      let totalJobs = c?.totalJobs ?? 0;
      let ratingVal = c?.rating ?? 0;
      if (useDemoData) {
        todayTotal = 128.0;
        weekTotal = 420.0;
        totalJobs = 7;
        ratingVal = 4.8;
      }
      setTodayEarnings(todayTotal);
      setWeeklyEarnings(weekTotal);
      setCompletedJobs(totalJobs);
      setRating(ratingVal);
      setIsOnline(c?.isOnline ?? false);

      const { data: profileRow, error: profileRowErr } = await supabase
        .from('cleaner_profiles')
        .select('*, user:users(*)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (profileRowErr) {
        console.warn('cleaner_profiles fetch for completion card:', profileRowErr);
      }
      const joinedUser = profileRow?.user;
      const u = Array.isArray(joinedUser) ? joinedUser[0] : joinedUser;
      const userMerged = mergeUserForProfileCompletion(u, user);
      const fields = getProfileCompletionFields(profileRow, userMerged);
      setCompletionFields(fields);
      if (fields.length > 0 && fields.every((f) => f.filled)) {
        sessionProfileChecklistDismissed.delete(user.id);
        try {
          await AsyncStorage.removeItem(profileCompletionDismissedKey(user.id));
        } catch {
          // no-op
        }
        setProfileCardDismissed(false);
      }

      if (useDemoData) {
        setJobOpportunities([]);
        setQuoteJobPreview([]);
        setActiveJob(null);
      } else {
        const proId = user.id;
        let quotePreview: BoardJob[] = [];
        try {
          const { data: cp } = await supabase
            .from('cleaner_profiles')
            .select('service_radius_km, specialties')
            .eq('user_id', proId)
            .single();
          const radiusMiles =
            cp?.service_radius_km != null ? Math.round(Number(cp.service_radius_km) * 0.621371) : 50;
          const firstSpecialty = cp?.specialties?.[0];
          const proCategory = firstSpecialty ? jobQuoteService.specialtyToCategory(firstSpecialty) : undefined;
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
          const qRes = await jobQuoteService.getAvailableJobsForPro(
            proId,
            proLat,
            proLng,
            proCategory ?? undefined,
            radiusMiles
          );
          if (qRes.success && qRes.data) {
            quotePreview = qRes.data.slice(0, 3);
          }
        } catch {
          quotePreview = [];
        }
        setQuoteJobPreview(quotePreview);

        const availableJobs = await cleanerBookingService.getAvailableBookings(user.id);
        const opportunities = availableJobs
          .slice(0, 3)
          .map((job) => ({
            id: job.id,
            customer_name: job.customerName,
            customer_avatar: job.customerAvatarUrl || '',
            service_type: job.serviceType,
            address: job.addressLine1,
            distance: job.distanceMiles,
            estimated_duration: job.durationMinutes,
            payment: job.payoutToCleaner,
            scheduled_time: new Date(job.scheduledAt).toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
            priority: job.isInstant ? 'high' : ('medium' as 'high' | 'medium' | 'low'),
          }));
        setJobOpportunities(opportunities);

        const activeBookings = await cleanerBookingService.getActiveBookings(user.id);
        const inProgressJob = activeBookings[0] ?? null;
        if (inProgressJob) {
          const st = inProgressJob.status;
          const uiStatus: ActiveJob['status'] =
            st === 'on_the_way'
              ? 'en_route'
              : st === 'arrived'
                ? 'arrived'
                : st === 'in_progress'
                  ? 'in_progress'
                  : 'confirmed';
          setActiveJob({
            id: inProgressJob.id,
            customer_name: inProgressJob.customerName,
            customer_avatar: inProgressJob.customerAvatarUrl || '',
            service_type: inProgressJob.serviceType,
            address: inProgressJob.addressLine1,
            status: uiStatus,
            scheduled_time: new Date(inProgressJob.scheduledAt).toLocaleString([], {
              weekday: 'short',
              hour: '2-digit',
              minute: '2-digit',
            }),
            payment: inProgressJob.payoutToCleaner,
          });
        } else {
          setActiveJob(null);
        }
      }

      console.log('✅ Dashboard loaded', {
        todayEarnings: todayTotal,
        weeklyEarnings: weekTotal,
        completedJobs: totalJobs,
        useDemoData,
      });
    } catch (error) {
      console.error('❌ Dashboard load error:', error);
      try {
        (showToast as any) && showToast({ type: 'error', message: 'Failed to load dashboard data' });
      } catch {
        // ignore
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const toggleOnlineStatus = async () => {
    const success = await useCleanerStore.getState().toggleOnlineStatus();
    if (!success) {
      Alert.alert('Could not update status', 'Please try again in a moment.');
      return;
    }
    setIsOnline(useCleanerStore.getState().currentCleaner?.isOnline ?? false);
  };

  const handleAcceptJob = async (jobId: string) => {
    const job = jobOpportunities.find(j => j.id === jobId);
    if (!job) return;

    Alert.alert(
      'Accept Job',
      `Accept ${job.service_type} for ${job.customer_name}?\n\nPay: $${job.payment.toFixed(2)}\nDistance: ${job.distance} mi away`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Accept', 
          onPress: () => performJobAcceptance(jobId)
        },
      ]
    );
  };

  const performJobAcceptance = async (jobId: string) => {
    if (!user?.id) return;

    try {
      // Show loading state
      setJobOpportunities(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, isAccepting: true }
            : job
        )
      );

      const response = await jobService.acceptJob(jobId, user.id);

      if (response.success) {
        // Success - move to active jobs
        const acceptedJob = jobOpportunities.find(j => j.id === jobId);
        if (acceptedJob) {
          setActiveJob({
            id: acceptedJob.id,
            customer_name: acceptedJob.customer_name,
            customer_avatar: acceptedJob.customer_avatar,
            service_type: acceptedJob.service_type,
            address: acceptedJob.address,
            status: 'confirmed',
            scheduled_time: acceptedJob.scheduled_time,
            payment: acceptedJob.payment
          });
        }

        // Remove from opportunities
        setJobOpportunities(prev => prev.filter(job => job.id !== jobId));

        // Success feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Job Accepted! 🎉',
          'The job has been added to your active jobs. You can now contact the customer.',
          [
            { text: 'View Active Jobs', onPress: () => navigation.navigate('Jobs') },
            { text: 'OK' }
          ]
        );

      } else {
        // Handle specific error cases
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        switch (response.errorCode) {
          case 'JOB_ALREADY_TAKEN':
            // Remove job from list since it's taken
            setJobOpportunities(prev => prev.filter(job => job.id !== jobId));
            Alert.alert(
              'Job Already Taken',
              'Another cleaner has already accepted this job. Don\'t worry, more opportunities are coming!',
              [{ text: 'OK' }]
            );
            break;

          case 'JOB_EXPIRED':
            // Remove expired job
            setJobOpportunities(prev => prev.filter(job => job.id !== jobId));
            Alert.alert(
              'Job No Longer Available',
              'This job has expired or been cancelled by the customer.',
              [{ text: 'OK' }]
            );
            break;

          case 'NETWORK_OFFLINE':
            Alert.alert(
              'No Internet Connection',
              'Your job acceptance will be processed when connection is restored. Keep the app open.',
              [
                { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
                { text: 'OK' }
              ]
            );
            break;

          case 'RATE_LIMITED':
            Alert.alert(
              'Too Many Requests',
              `Please wait ${response.retryAfter || 60} seconds before trying again.`,
              [{ text: 'OK' }]
            );
            break;

          case 'TIMEOUT':
            Alert.alert(
              'Request Timed Out',
              'The request took too long. Please check your connection and try again.',
              [
                { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
                { text: 'Cancel' }
              ]
            );
            break;

          default:
            Alert.alert(
              'Unable to Accept Job',
              response.error || 'Something went wrong. Please try again.',
              [
                { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
                { text: 'Cancel' }
              ]
            );
        }
      }

    } catch (error) {
      console.error('Job acceptance error:', error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [
          { text: 'Retry', onPress: () => performJobAcceptance(jobId) },
          { text: 'Cancel' }
        ]
      );
    } finally {
      // Remove loading state
      setJobOpportunities(prev => 
        prev.map(job => 
          job.id === jobId 
            ? { ...job, isAccepting: false }
            : job
        )
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return UI.info;
      case 'en_route': return UI.warning;
      case 'arrived': return UI.success;
      case 'in_progress': return UI.primary;
      default: return UI.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'en_route': return 'En Route';
      case 'arrived': return 'Arrived';
      case 'in_progress': return 'In Progress';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return UI.error;
      case 'medium': return UI.warning;
      case 'low': return UI.success;
      default: return UI.textSecondary;
    }
  };

  const rankFromProfileCompletionPct = (p: number) => {
    if (p >= 100) return { name: 'Profile complete', blurb: 'You are set to get bookings' };
    if (p >= 75) return { name: 'Almost there', blurb: 'Finish the last few items' };
    if (p >= 50) return { name: 'Strong start', blurb: 'Add details to build trust' };
    if (p >= 25) return { name: 'Getting going', blurb: 'Every step helps' };
    return { name: 'Build your profile', blurb: 'Complete each step' };
  };

  const profilePrimaryAction = (incomplete: ProfileCompletionField[]) => {
    if (incomplete.length === 1 && incomplete[0].id === 'background') {
      return { mode: 'settings' as const };
    }
    return { mode: 'edit' as const };
  };

  const renderProfileCompletion = () => {
    if (completionFields.length === 0) {
      return null;
    }

    const incomplete = completionFields.filter((f) => !f.filled);
    const totalW = completionFields.reduce((s, f) => s + f.weight, 0);
    const filledW = completionFields.reduce((s, f) => s + (f.filled ? f.weight : 0), 0);
    const pct = totalW > 0 ? Math.round((filledW / totalW) * 1000) / 10 : 0;
    const remaining = incomplete.length;
    const { name: rankName, blurb: rankBlurb } = rankFromProfileCompletionPct(pct);
    const primary = profilePrimaryAction(incomplete);
    const onlyBackgroundPending = primary.mode === 'settings';

    const goNextProfileStep = () => {
      const target = getNextCleanerCompletionNavTarget(incomplete);
      navigation.navigate(target as keyof StackParamList);
    };

    if (incomplete.length === 0) {
      return null;
    }

    if (profileCardDismissed) {
      return null;
    }

    return (
      <View style={styles.profileCompletionOuter}>
        <View style={[styles.profileCompletionShadow, shadows.metricFloat]}>
          <View style={styles.profileCompletionClip}>
            <View style={styles.profileCompletionCard}>
              <View style={styles.completionHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.completionTitle}>
                    {onlyBackgroundPending ? 'Almost there' : 'Profile checklist'}
                  </Text>
                  <View style={styles.completionRankRow}>
                    <Ionicons name="trophy" size={14} color={BRAND} />
                    <Text style={styles.completionRankText}>
                      {rankName} · {rankBlurb}
                    </Text>
                  </View>
                  <Text style={styles.completionSubtitle}>
                    {Math.round(pct)}%{remaining > 0 ? ` · ${remaining} left` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={async () => {
                    if (user?.id && !user.id.startsWith('demo_')) {
                      sessionProfileChecklistDismissed.add(user.id);
                    }
                    setProfileCardDismissed(true);
                    if (user?.id && !user.id.startsWith('demo_')) {
                      try {
                        await AsyncStorage.setItem(profileCompletionDismissedKey(user.id), '1');
                      } catch {
                        // no-op
                      }
                    }
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss profile reminder"
                >
                  <Ionicons name="close" size={20} color={UI.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
                </View>
              </View>

              <View style={styles.completionItems}>
                {incomplete.slice(0, 2).map((item) => (
                  <View key={item.id} style={styles.completionItem}>
                    <Ionicons name="ellipse-outline" size={16} color={UI.error} />
                    <Text style={styles.completionItemText}>{item.label}</Text>
                  </View>
                ))}
              </View>

              {onlyBackgroundPending ? (
                <View style={styles.completionNote}>
                  <Text style={styles.completionNoteText}>
                    Background check still processing — your score updates when it clears.
                  </Text>
                </View>
              ) : null}

              <View style={styles.completionActions}>
                {onlyBackgroundPending ? (
                  <>
                    <TouchableOpacity
                      style={styles.completeProfileButton}
                      onPress={() => navigation.navigate('SettingsScreen')}
                    >
                      <Ionicons name="settings-outline" size={16} color={UI.textInverse} />
                      <Text style={styles.completeProfileButtonText} numberOfLines={1}>
                        Account & status
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.uploadContentButton}
                      onPress={() => navigation.navigate('Profile')}
                    >
                      <Ionicons name="person" size={16} color={BRAND} />
                      <Text style={styles.uploadContentButtonText}>View profile</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity style={styles.completeProfileButton} onPress={goNextProfileStep}>
                    <Ionicons name="arrow-forward-circle" size={16} color={UI.textInverse} />
                    <Text style={styles.completeProfileButtonText}>Continue</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderGoalsTracker = () => {
    const progressPercentage = Math.min((weeklyEarnings / weeklyGoal) * 100, 100);
    const remaining = Math.max(weeklyGoal - weeklyEarnings, 0);
    
    const handleGoalPress = async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsEditingGoal(true);
    };

    return (
      <View style={styles.goalsRowOuter}>
        <View style={[styles.goalsShadow, shadows.metricFloat]}>
          <View style={styles.goalsClip}>
            <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.goalsCardGradient}>
              <View style={styles.goalsHeader}>
                <Ionicons name="trophy" size={20} color={UI.warning} />
                <Text style={styles.goalsTitle}>This Week's Goal</Text>
                <TouchableOpacity onPress={handleGoalPress} style={styles.editGoalButton}>
                  <Ionicons name="pencil" size={16} color={BRAND} />
                </TouchableOpacity>
              </View>
              <View style={styles.goalsContent}>
                {isEditingGoal ? (
                  <View style={styles.goalEditContainer}>
                    <Text style={styles.goalEditLabel}>Weekly Goal</Text>
                    <TextInput
                      style={styles.goalEditInput}
                      value={weeklyGoal.toString()}
                      onChangeText={(text) => {
                        const value = parseInt(text) || 0;
                        setWeeklyGoal(value);
                      }}
                      onBlur={() => setIsEditingGoal(false)}
                      keyboardType="numeric"
                      selectTextOnFocus
                      autoFocus
                    />
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleGoalPress}>
                    <Text style={styles.goalsAmount}>${weeklyGoal}</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.goalsProgress}>
                  <View style={styles.goalsProgressBar}>
                    <Animated.View
                      style={[
                        styles.goalsProgressFill,
                        { width: `${progressPercentage}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.goalsProgressText}>
                    {progressPercentage.toFixed(0)}% there! • ${remaining.toFixed(2)} remaining
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>
      </View>
    );
  };

  const renderStatsCard = () => (
    <View style={styles.statsOuter}>
      <View style={[styles.statsShadow, shadows.metricFloat]}>
        <View style={styles.statsClip}>
          <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.statsGradient}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsTitle}>Today's Performance</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Earnings')}>
                <Ionicons name="chevron-forward" size={20} color={BRAND} />
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Ionicons name="cash" size={18} color={BRAND} style={styles.statIcon} />
                <Text style={styles.statValue}>${todayEarnings.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="trending-up" size={18} color={BRAND} style={styles.statIcon} />
                <Text style={styles.statValue}>${weeklyEarnings.toFixed(2)}</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={18} color={BRAND} style={styles.statIcon} />
                <Text style={styles.statValue}>{completedJobs}</Text>
                <Text style={styles.statLabel}>Jobs Done</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="star" size={18} color={BRAND} style={styles.statIcon} />
                <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </View>
  );

  const renderOnlineToggle = () => (
    <View style={styles.onlineToggleContainer}>
      <View style={styles.onlineToggleContent}>
        <View style={styles.onlineStatus}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? UI.success : UI.error }]} />
          <Text style={styles.onlineStatusText}>
            {isOnline ? 'Available for Jobs' : 'Offline'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.toggleButton, { backgroundColor: isOnline ? UI.success : UI.error }]}
          onPress={toggleOnlineStatus}
        >
          <Text style={styles.toggleButtonText}>
            {isOnline ? 'Go Offline' : 'Go Online'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActiveJob = () => {
    if (!activeJob) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Job</Text>
          <TouchableOpacity onPress={() => navigation.navigate('JobDetails', { jobId: activeJob.id })}>
            <Text style={styles.viewAllText}>View Details</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activeJobWrap}>
          <View style={[styles.activeJobShadow, shadows.metricFloat]}>
            <View style={styles.activeJobClip}>
              <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.activeJobCardGradient}>
                <View style={styles.activeJobHeader}>
                  {activeJob.customer_avatar ? (
                    <Image source={{ uri: activeJob.customer_avatar }} style={styles.customerAvatar} />
                  ) : (
                    <View style={[styles.customerAvatar, styles.customerAvatarPlaceholder]}>
                      <Ionicons name="person" size={20} color={UI.textMuted} />
                    </View>
                  )}
                  <View style={styles.activeJobInfo}>
                    <Text style={styles.customerName}>{activeJob.customer_name}</Text>
                    <Text style={styles.serviceType}>{activeJob.service_type}</Text>
                    <Text style={styles.jobAddress}>{activeJob.address}</Text>
                  </View>
                  <View style={styles.activeJobStatus}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(activeJob.status) }]}>
                      <Text style={styles.statusText}>{getStatusText(activeJob.status)}</Text>
                    </View>
                    <Text style={styles.jobPayment}>${activeJob.payment.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.activeJobActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => navigation.navigate('IndividualChat', {
                      bookingId: activeJob.id,
                      otherParticipant: {
                        id: 'customer-1',
                        name: activeJob.customer_name,
                        avatar_url: activeJob.customer_avatar,
                        role: 'customer'
                      }
                    })}
                  >
                    <Ionicons name="chatbubble" size={18} color={BRAND} />
                    <Text style={styles.actionButtonText}>Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="navigate" size={18} color={BRAND} />
                    <Text style={styles.actionButtonText}>Navigate</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const hasOpportunityPreview = quoteJobPreview.length > 0 || jobOpportunities.length > 0;

  const renderJobOpportunities = () => (
    <View style={styles.section}>
      <View style={styles.opportunitiesHeaderBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>New opportunities</Text>
        </View>
      </View>

      {!hasOpportunityPreview ? (
        <EmptyState
          {...EmptyStateConfigs.jobOpportunities}
          ctaAccentColor={BRAND}
          actions={[
            {
              label: 'Browse jobs',
              onPress: () => navigation.navigate('Jobs'),
              icon: 'briefcase',
              primary: true,
            },
          ]}
        />
      ) : (
        <View style={styles.opportunitiesList}>
          {quoteJobPreview.map((qj) => (
            <View key={`quote-${qj.id}`} style={[styles.jobCardLift, shadows.metricFloat]}>
              <TouchableOpacity
                style={styles.jobCard}
                onPress={() => navigation.navigate('QuoteJobDetail', { jobId: qj.id })}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[UI.surface, STATS_GRADIENT_END]}
                  style={[styles.jobCardGradientFill, styles.quotePreviewRow]}
                >
                  <View style={styles.quotePreviewRowInner}>
                    <View style={styles.quotePreviewIcon}>
                      <Ionicons name="videocam" size={22} color={BRAND} />
                    </View>
                    <View style={styles.quotePreviewTextCol}>
                      <Text style={styles.quotePreviewHeadline} numberOfLines={2}>
                        {qj.headline}
                      </Text>
                      <View style={styles.quotePreviewMeta}>
                        <Text style={styles.quotePreviewCategory}>
                          {jobQuoteService.getCategoryLabel(qj.category)}
                        </Text>
                        {qj.distance_miles != null && (
                          <Text style={styles.quotePreviewDistance}>{qj.distance_miles} mi away</Text>
                        )}
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={UI.textSecondary} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ))}

          {jobOpportunities.map((job) => (
            <View key={job.id} style={[styles.jobCardLift, shadows.metricFloat]}>
            <TouchableOpacity
              style={styles.jobCard}
              onPress={() => navigation.navigate('JobDetails', { jobId: job.id })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.jobCardGradientFill}>
              <View style={styles.jobHeader}>
                {job.customer_avatar ? (
                  <Image source={{ uri: job.customer_avatar }} style={styles.customerAvatar} />
                ) : (
                  <View style={[styles.customerAvatar, styles.customerAvatarPlaceholder]}>
                    <Ionicons name="person" size={20} color={UI.textMuted} />
                  </View>
                )}
                <View style={styles.jobInfo}>
                  <View style={styles.jobTitleRow}>
                    <Text style={styles.customerName}>{job.customer_name}</Text>
                    <Animated.View
                      style={[
                        styles.jobStatusContainer,
                        {
                          transform: [
                            {
                              scale: badgeShimmer.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 1.1, 1],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Ionicons name="flash" size={14} color={UI.textInverse} />
                      <Text style={styles.jobStatusText}>
                        {job.priority === 'high' ? 'INSTANT' : 'NEW'}
                      </Text>
                    </Animated.View>
                  </View>
                  <Text style={styles.serviceType}>{job.service_type}</Text>
                  <Text style={styles.jobAddress}>{job.address}</Text>
                  <View style={styles.jobDetails}>
                    <Text style={styles.jobDetailText}>{job.distance} mi away</Text>
                    <Text style={styles.jobDetailText}>•</Text>
                    <Text style={styles.jobDetailText}>{job.estimated_duration} min</Text>
                    <Text style={styles.jobDetailText}>•</Text>
                    <Text style={styles.jobDetailText}>{job.scheduled_time}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.jobFooter}>
                <Text style={styles.jobPayment}>${job.payment.toFixed(2)}</Text>
                <TouchableOpacity
                  style={[styles.acceptButton, job.isAccepting && styles.acceptButtonLoading]}
                  onPress={() => handleAcceptJob(job.id)}
                  disabled={job.isAccepting}
                >
                  <LinearGradient
                    colors={[BRAND, BRAND_GRADIENT_END]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.acceptButtonGradient}
                  >
                    {job.isAccepting ? (
                      <View style={styles.acceptButtonLoadingContent}>
                        <ActivityIndicator size="small" color={UI.textInverse} />
                        <Text style={styles.acceptButtonText}>Accepting...</Text>
                      </View>
                    ) : (
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              </LinearGradient>
            </TouchableOpacity>
            </View>
          ))}

          <View style={[styles.browseJobsLift, shadows.metricFloat]}>
          <TouchableOpacity
            style={styles.browseJobsButtonWrap}
            onPress={() => navigation.navigate('Jobs')}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Browse all open jobs"
          >
            <LinearGradient
              colors={[UI.surface, STATS_GRADIENT_END]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.browseJobsGradient}
            >
              <Text style={styles.browseJobsButtonText}>Browse jobs</Text>
              <Ionicons name="arrow-forward" size={20} color={BRAND} />
            </LinearGradient>
          </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <View style={[styles.quickActionLift, shadows.metricFloat]}>
          <TouchableOpacity
            style={styles.quickActionTouchable}
            onPress={() => navigation.navigate('Schedule')}
          >
            <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.quickActionGradient}>
              <Ionicons name="calendar" size={24} color={BRAND} />
              <Text style={styles.quickActionText}>Schedule</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={[styles.quickActionLift, shadows.metricFloat]}>
          <TouchableOpacity
            style={styles.quickActionTouchable}
            onPress={() => navigation.navigate('Earnings')}
          >
            <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.quickActionGradient}>
              <Ionicons name="card" size={24} color={BRAND} />
              <Text style={styles.quickActionText}>Earnings</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={[styles.quickActionLift, shadows.metricFloat]}>
          <TouchableOpacity
            style={styles.quickActionTouchable}
            onPress={() => navigation.navigate('VideoUpload')}
          >
            <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.quickActionGradient}>
              <Ionicons name="videocam" size={24} color={BRAND} />
              <Text style={styles.quickActionText}>Create Post</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={[styles.quickActionLift, shadows.metricFloat]}>
          <TouchableOpacity
            style={styles.quickActionTouchable}
            onPress={() => navigation.navigate('Tips')}
          >
            <LinearGradient colors={[UI.surface, STATS_GRADIENT_END]} style={styles.quickActionGradient}>
              <Ionicons name="bulb" size={24} color={BRAND} />
              <Text style={styles.quickActionText}>Tips</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={UI.surface} />
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <View style={{ gap: wp('4%') }}>
            <SkeletonBlock height={64} />
            <SkeletonBlock height={120} />
            <SkeletonList rows={3} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={UI.surface} />
      
      <NetworkStatusIndicator onNetworkChange={(isConnected) => {
        console.log('Network status changed:', isConnected);
        // Optionally update dashboard state based on connection
      }} />
      
      {/* Enhanced Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.userName}>{user?.name || 'Professional Cleaner'}! 👋</Text>
            {/*
              The dashboard header used to host an Online/Offline toggle pill.
              The canonical control now lives on the Profile screen, and online
              status is reflected by the green ring around the avatar in the
              header. Keeps the dashboard cleaner and avoids duplicate UI.
            */}
          </View>
          
          <View style={styles.headerRight}>
            {/* Notifications */}
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => navigation.navigate('NotificationsScreen')}
              accessibilityLabel="View notifications"
              accessibilityHint="View your recent notifications and alerts"
            >
              <Animated.View style={{ transform: [{ scale: notificationCount > 0 ? notificationPulse : 1 }] }}>
                <Ionicons name="notifications" size={24} color={COLORS.text.primary} />
              </Animated.View>
              {(notificationCount > 0 || (useDemoData && notificationCount === 0)) && (
                <Animated.View 
                  style={[
                    styles.notificationBadge,
                    { transform: [{ scale: notificationPulse }] }
                  ]}
                >
                  <Text style={styles.notificationBadgeText}>
                    {useDemoData && notificationCount === 0 ? '3' : notificationCount}
                  </Text>
                </Animated.View>
              )}
            </TouchableOpacity>
            
            {/*
              Profile avatar with online-status ring.
              The ring is GREEN only when the cleaner is online AND profile is
              complete enough to take jobs. Otherwise the avatar stays plain so
              cleaners aren't misled into thinking they're discoverable.
            */}
            <View style={styles.profileContainer}>
              <TouchableOpacity style={styles.profileButton} accessibilityRole="button" accessibilityLabel={isOnline ? 'You are online' : 'You are offline'}>
                {isOnline ? <View style={styles.profileOnlineRing} /> : null}
                <Image
                  source={{ uri: user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Cleaner')}&background=FFA52F&color=fff&size=120&font-size=0.4&format=png` }}
                  style={styles.profileImage}
                />
                <View style={[styles.profileBadge, { backgroundColor: isOnline ? UI.success : UI.textMuted }]}>
                  <Ionicons name="checkmark" size={12} color={UI.textInverse} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editProfileButton}
                onPress={() => navigation.navigate('CleanerProfileEdit')}
              >
                <Ionicons name="pencil" size={14} color={BRAND} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {renderProfileCompletion()}
        
        {renderStatsCard()}
        {renderGoalsTracker()}
        {renderQuickActions()}
        {renderActiveJob()}
        {renderJobOpportunities()}
      </ScrollView>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: UI.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: UI.textSecondary,
  },
  header: {
    backgroundColor: UI.surface,
    paddingHorizontal: wp('5%'),
    paddingTop: hp('1.5%'),
    paddingBottom: hp('1.4%'),
    borderBottomWidth: 1,
    borderBottomColor: UI.borderSoft,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
    marginBottom: hp('0.5%'),
  },
  userName: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: UI.textPrimary,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: wp('5.5%'),
  },
  // Green pulse around the avatar when the cleaner is online and visible to
  // customers. Sized 4px larger than the photo so it reads as a ring.
  profileOnlineRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: wp('5.5%') + 3,
    borderWidth: 2.5,
    borderColor: UI.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120, // Extra space for floating nav
    paddingTop: hp('1%'),
  },
  statsOuter: {
    marginHorizontal: wp('5%'),
    marginTop: hp('1.5%'),
    marginBottom: hp('2%'),
  },
  statsShadow: {
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  statsClip: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.borderSoft,
    backgroundColor: UI.surface,
  },
  statsGradient: {
    padding: 18,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2.5%'),
  },
  statsTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: BRAND,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: hp('0.5%'),
  },
  statLabel: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
  },
  onlineToggleContainer: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('2%'),
    backgroundColor: UI.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: UI.border,
  },
  onlineToggleContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: wp('1.5%'),
    marginRight: 12,
  },
  onlineStatusText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textPrimary,
  },
  toggleButton: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('5%'),
  },
  toggleButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.textInverse,
  },
  section: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('3.5%'),
  },
  opportunitiesHeaderBlock: {
    marginBottom: hp('1%'),
  },
  opportunitiesList: {
    width: '100%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  sectionTitle: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: UI.textPrimary,
  },
  viewAllText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.primary,
  },
  activeJobWrap: {},
  activeJobShadow: {
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  activeJobClip: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: UI.borderSoft,
  },
  activeJobCardGradient: {
    padding: 16,
    borderRadius: 16,
  },
  activeJobHeader: {
    flexDirection: 'row',
    marginBottom: hp('2%'),
  },
  customerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  customerAvatarPlaceholder: {
    backgroundColor: UI.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeJobInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textPrimary,
    marginBottom: hp('0.5%'),
  },
  serviceType: {
    fontSize: wp('3.5%'),
    color: UI.primary,
    fontWeight: '500',
    marginBottom: hp('0.5%'),
  },
  jobAddress: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
  },
  activeJobStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.7%'),
    borderRadius: wp('4%'),
    marginBottom: hp('1%'),
  },
  statusText: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: UI.textInverse,
  },
  jobPayment: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: UI.textPrimary,
  },
  activeJobActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: hp('2%'),
    borderTopWidth: 1,
    borderTopColor: UI.border,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: wp('4%'),
    backgroundColor: UI.surface,
    borderRadius: wp('5.5%'),
    borderWidth: 1,
    borderColor: UI.borderSoft,
  },
  actionButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.primary,
    marginLeft: 8,
  },
  jobCardLift: {
    marginBottom: hp('1%'),
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  jobCard: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    borderWidth: 0,
    overflow: 'hidden',
  },
  jobCardGradientFill: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: UI.borderSoft,
  },
  quotePreviewRow: {
    paddingVertical: 12,
  },
  quotePreviewRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quotePreviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quotePreviewTextCol: {
    flex: 1,
    minWidth: 0,
  },
  quotePreviewHeadline: {
    fontSize: wp('3.8%'),
    fontWeight: '600',
    color: UI.textPrimary,
  },
  quotePreviewMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
  },
  quotePreviewCategory: {
    fontSize: wp('3.2%'),
    color: BRAND,
    fontWeight: '500',
  },
  quotePreviewDistance: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
    marginLeft: 8,
  },
  browseJobsLift: {
    marginTop: hp('0.5%'),
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  browseJobsButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  browseJobsGradient: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.borderSoft,
  },
  browseJobsButtonText: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: UI.textPrimary,
  },
  jobHeader: {
    flexDirection: 'row',
    marginBottom: hp('1.5%'),
  },
  jobInfo: {
    flex: 1,
  },
  jobTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: wp('1%'),
    marginLeft: 8,
  },
  jobDetails: {
    flexDirection: 'row',
    marginTop: hp('1%'),
  },
  jobDetailText: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
    marginRight: 8,
  },
  jobFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  acceptButton: {
    height: 42,
    paddingHorizontal: 0,
    borderRadius: 999,
    overflow: 'hidden',
    minWidth: 100,
    alignSelf: 'flex-end',
  },
  acceptButtonGradient: {
    minWidth: 100,
    height: 42,
    paddingHorizontal: wp('5%'),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  acceptButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: UI.textInverse,
  },
  acceptButtonLoading: {
    opacity: 0.85,
  },
  acceptButtonLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  quickActionsContainer: {
    margin: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp('2%'),
  },
  quickActionLift: {
    width: (width - 60) / 4,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  quickActionTouchable: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  quickActionGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.borderSoft,
  },
  quickActionText: {
    fontSize: wp('3%'),
    fontWeight: '500',
    color: UI.textPrimary,
    marginTop: hp('1%'),
    textAlign: 'center',
  },
  // Enhanced Header Styles
  headerLeft: {
    flex: 1,
  },
  headerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp('1%'),
    gap: wp('2%'),
    alignSelf: 'flex-start',
  },
  onlineStatusTextSmall: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
    fontWeight: '500',
  },
  toggleButtonSmall: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
  },
  toggleButtonTextSmall: {
    fontSize: 11,
    color: UI.textInverse,
    fontWeight: '600',
  },
  profileBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: UI.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: UI.surface,
  },
  // Profile Completion Styles
  profileCompletionOuter: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('3%'),
  },
  profileCompletionShadow: {
    borderRadius: wp('4%'),
    backgroundColor: 'transparent',
  },
  profileCompletionClip: {
    borderRadius: wp('4%'),
    overflow: 'hidden',
  },
  profileCompletionCard: {
    backgroundColor: UI.surface,
    borderRadius: wp('4%'),
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: BRAND,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp('1.5%'),
  },
  completionTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textPrimary,
    marginBottom: hp('0.5%'),
  },
  completionRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: hp('0.4%'),
  },
  completionRankText: {
    fontSize: wp('3.1%'),
    fontWeight: '600',
    color: BRAND,
  },
  completionSubtitle: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
  },
  progressBarContainer: {
    marginBottom: hp('2%'),
  },
  progressBar: {
    height: 6,
    backgroundColor: UI.borderSoft,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: UI.primary,
    borderRadius: 3,
  },
  completionItems: {
    gap: wp('2%'),
    marginBottom: hp('2%'),
  },
  completionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  completionItemText: {
    fontSize: wp('3.5%'),
    color: UI.textSecondary,
  },
  completeProfileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp('2%'),
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('3%'),
    backgroundColor: BRAND,
    borderRadius: wp('3%'),
  },
  completeProfileButtonText: {
    fontSize: wp('3.5%'),
    color: UI.textInverse,
    fontWeight: '600',
  },
  // Goals Tracker Styles
  goalsRowOuter: {
    marginHorizontal: wp('5%'),
    marginBottom: hp('3%'),
  },
  goalsShadow: {
    borderRadius: wp('4%'),
    backgroundColor: 'transparent',
  },
  goalsClip: {
    borderRadius: wp('4%'),
    overflow: 'hidden',
  },
  goalsCardGradient: {
    padding: 20,
  },
  goalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
    marginBottom: hp('1.5%'),
  },
  goalsTitle: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: UI.textPrimary,
    flex: 1,
  },
  editGoalButton: {
    padding: 4,
    borderRadius: wp('3%'),
    backgroundColor: `${BRAND}22`,
  },
  goalEditContainer: {
    alignItems: 'center',
  },
  goalEditLabel: {
    fontSize: wp('3%'),
    color: COLORS.text.secondary,
    marginBottom: hp('0.5%'),
  },
  goalEditInput: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: UI.success,
    textAlign: 'center',
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderWidth: 2,
    borderColor: BRAND,
    borderRadius: wp('2%'),
    backgroundColor: UI.surface,
    minWidth: 80,
  },
  goalsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalsAmount: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: UI.success,
  },
  goalsProgress: {
    flex: 1,
    marginLeft: 16,
  },
  goalsProgressBar: {
    height: 8,
    backgroundColor: UI.borderSoft,
    borderRadius: wp('1%'),
    overflow: 'hidden',
    marginBottom: hp('0.5%'),
  },
  goalsProgressFill: {
    height: '100%',
    backgroundColor: UI.warning,
    borderRadius: wp('1%'),
  },
  goalsProgressText: {
    fontSize: wp('3%'),
    color: UI.textSecondary,
    textAlign: 'right',
  },
  // Enhanced Stats Styles
  statIcon: {
    marginBottom: hp('0.5%'),
  },
  // Profile Completion Enhancement
  completionNote: {
    marginBottom: hp('2%'),
    paddingTop: hp('1.5%'),
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  completionNoteText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
  // Enhanced Header Styles
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('3%'),
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.error,
    borderRadius: wp('2%'),
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  notificationBadgeText: {
    fontSize: wp('2.5%'),
    color: COLORS.text.inverse,
    fontWeight: '700',
  },
  profileContainer: {
    position: 'relative',
  },
  editProfileButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.surface,
    borderRadius: wp('3%'),
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: UI.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  jobStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND,
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('3%'),
    gap: wp('1%'),
    shadowColor: BRAND,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  jobStatusText: {
    fontSize: wp('2.5%'),
    fontWeight: '700',
    color: UI.textInverse,
    textTransform: 'uppercase',
  },
  // Empty Jobs State
  emptyJobsContainer: {
    alignItems: 'center',
    paddingVertical: hp('5%'),
    paddingHorizontal: wp('5%'),
  },
  emptyJobsTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: COLORS.text.primary,
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  emptyJobsSubtitle: {
    fontSize: wp('3.5%'),
    color: COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: hp('3%'),
  },
  completeProfileButtonAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND,
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    gap: wp('2%'),
  },
  completeProfileButtonAltText: {
    fontSize: wp('3.5%'),
    color: COLORS.text.inverse,
    fontWeight: '600',
  },
  // Enhanced Completion Actions
  completionActions: {
    flexDirection: 'row',
    gap: wp('3%'),
    marginTop: hp('0.5%'),
  },

  uploadContentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: BRAND,
    paddingVertical: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    borderRadius: wp('3%'),
    gap: wp('2%'),
    justifyContent: 'center',
  },
  uploadContentButtonText: {
    fontSize: wp('3.5%'),
    color: BRAND,
    fontWeight: '600',
  },
  // Empty Jobs Actions
  emptyJobsActions: {
    gap: wp('3%'),
  },
  testBookingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: BRAND,
    paddingHorizontal: wp('6%'),
    paddingVertical: hp('1.5%'),
    borderRadius: wp('3%'),
    gap: wp('2%'),
    justifyContent: 'center',
  },
  testBookingButtonText: {
    fontSize: wp('3.5%'),
    color: BRAND,
    fontWeight: '600',
  },
  // Demo Toggle Styles
  demoToggleButton: {
    width: 36,
    height: 36,
    borderRadius: wp('4.5%'),
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoToggleButtonActive: {
    borderColor: BRAND,
    backgroundColor: `${BRAND}18`,
  },
});

export default CleanerDashboardScreen; 