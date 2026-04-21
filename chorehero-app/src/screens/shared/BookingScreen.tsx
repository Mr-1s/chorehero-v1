import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  Alert,
  Animated,
  Dimensions,
  Switch,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import FloatingNavigation from '../../components/FloatingNavigation';
import { Card, Chip, Button } from '../../components/ui';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { notificationService } from '../../services/notificationService';
import { jobQuoteService, Job, Quote } from '../../services/jobQuoteService';
import { bookingService } from '../../services/booking';

import { routeToMessage } from '../../utils/messageRouting';
import { wp, hp } from '../../utils/responsive';

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
};

type StackParamList = {
  MainTabs: undefined;
  CleanerProfile: { cleanerId: string };
  BookingConfirmed: { bookingId: string };
  LiveTracking: { bookingId: string };
  IndividualChat: { cleanerId: string; bookingId: string };
  RatingReview: {
    bookingId: string;
    cleaner: {
      id: string;
      name: string;
      avatar: string;
    };
    service: {
      title: string;
      completedAt: string;
    };
  };
  TipAndReview: {
    bookingId: string;
    cleanerId: string;
    cleanerName: string;
    cleanerPhoto: string;
    serviceTitle: string;
    serviceCost: number;
  };
};

type BookingScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Bookings'>,
  StackNavigationProp<StackParamList>
>;

interface BookingScreenProps {
  navigation: BookingScreenNavigationProp;
  route?: {
    params?: {
      activeTab?: 'my-jobs' | 'quotes' | 'upcoming' | 'history';
      bookingId?: string;
      showTracking?: boolean;
    };
  };
}

const { width, height } = Dimensions.get('window');

interface Booking {
  id: string;
  service: string;
  messagingEnabled?: boolean;
  provider: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
    phone: string;
  };
  date: string;
  time: string;
  duration: string;
  scheduledAt: string;
  status: 'upcoming' | 'active' | 'completed';
  progress: number;
  eta: string;
  address: string;
  price: number;
  hasReview?: boolean;
  location: {
    latitude: number;
    longitude: number;
  };
  providerLocation?: {
    latitude: number;
    longitude: number;
  };
  milestones: Milestone[];
  currentMilestone: number;
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  timestamp?: string;
  icon: string;
}

const BookingScreen: React.FC<BookingScreenProps> = ({ navigation: propNavigation, route }) => {
  const navigation = useNavigation<CompositeNavigationProp<
    BottomTabNavigationProp<TabParamList, 'Bookings'>,
    StackNavigationProp<StackParamList>
  >>();
  
  // Get navigation parameters
  const params = route?.params || {};
  const initialTab = (params.activeTab as 'my-jobs' | 'quotes' | 'upcoming' | 'history') || 'upcoming';
  const targetBookingId = params.bookingId;
  const shouldShowTracking = params.showTracking;
  
  
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'my-jobs' | 'quotes' | 'upcoming' | 'history'>(initialTab);
  const [animatedValue] = useState(new Animated.Value(0));
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quotes, setQuotes] = useState<(Quote & { job?: Job })[]>([]);
  const [now, setNow] = useState(new Date());
  const [jobMenu, setJobMenu] = useState<Job | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (params.activeTab) setActiveTab(params.activeTab as any);
  }, [params.activeTab]);

  // Load real bookings from database
  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const LOAD_TIMEOUT_MS = 12000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Load timeout')), LOAD_TIMEOUT_MS)
    );

    try {
      console.log('📅 Loading bookings for user:', user.id);

      const fetchBookings = async () => {
        const { data: rawBookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          service_type,
          status,
          scheduled_time,
          estimated_duration,
          total_amount,
          special_instructions,
          created_at,
          cleaner_id,
          messaging_enabled,
          address:addresses!address_id(street, city, state, zip_code)
        `)
        .eq('customer_id', user.id)
        .eq('payment_status', 'succeeded')
        .order('scheduled_time', { ascending: false });

      const bookingIds = (rawBookings || []).map((booking: any) => booking.id).filter(Boolean);
      const reviewMap = new Set<string>();
      if (bookingIds.length > 0) {
        const { data: reviews, error: reviewError } = await supabase
          .from('reviews')
          .select('booking_id')
          .in('booking_id', bookingIds);
        if (!reviewError && reviews) {
          reviews.forEach((review: any) => {
            if (review?.booking_id) reviewMap.add(review.booking_id);
          });
        }
      }

      // Fetch cleaner profiles separately for ratings + user info
      const cleanerIds = [...new Set((rawBookings || []).map((b: any) => b.cleaner_id).filter(Boolean))];
      const { data: profiles } = cleanerIds.length > 0 
        ? await supabase
            .from('cleaner_profiles')
            .select('user_id, rating_average')
            .in('user_id', cleanerIds)
        : { data: [] };
      const { data: cleaners } = cleanerIds.length > 0
        ? await supabase
            .from('users')
            .select('id, name, avatar_url, phone')
            .in('id', cleanerIds)
        : { data: [] };
      
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const cleanerMap = new Map((cleaners || []).map((c: any) => [c.id, c]));

      if (error) {
        console.error('❌ Error fetching bookings:', error);
        setBookings([]);
        return;
      }

      // Transform raw bookings to Booking interface
      const transformedBookings: Booking[] = (rawBookings || []).map((booking: any) => {
        const scheduledDate = new Date(booking.scheduled_time);
        const now = new Date();
        const isToday = scheduledDate.toDateString() === now.toDateString();
        const isTomorrow = scheduledDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
        const isYesterday = scheduledDate.toDateString() === new Date(now.getTime() - 86400000).toDateString();
        
        let dateLabel = scheduledDate.toLocaleDateString();
        if (isToday) dateLabel = 'Today';
        else if (isTomorrow) dateLabel = 'Tomorrow';
        else if (isYesterday) dateLabel = 'Yesterday';

        // Map database status to UI status
        let uiStatus: 'upcoming' | 'active' | 'completed' = 'upcoming';
        let progress = 0;
        if (['pending', 'confirmed'].includes(booking.status)) {
          uiStatus = 'upcoming';
          progress = 0;
        } else if (['cleaner_en_route', 'cleaner_arrived', 'in_progress'].includes(booking.status)) {
          uiStatus = 'active';
          progress = booking.status === 'cleaner_en_route' ? 25 : 
                     booking.status === 'cleaner_arrived' ? 50 : 75;
        } else if (['completed', 'cancelled'].includes(booking.status)) {
          uiStatus = 'completed';
          progress = 100;
        }

        // Get cleaner profile from map
        const cleanerProfile = profileMap.get(booking.cleaner_id);

        // Generate milestones based on status
        const cleaner = booking.cleaner_id ? cleanerMap.get(booking.cleaner_id) || null : null;
        const milestones: Milestone[] = [
          {
            id: '1',
            title: 'Booking Confirmed',
            description: 'Your service has been confirmed',
            completed: true,
            timestamp: new Date(booking.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            icon: 'checkmark-circle',
          },
          {
            id: '2',
            title: 'Cleaner En Route',
            description: `${cleaner?.name || 'Cleaner'} is on the way`,
            completed: ['cleaner_en_route', 'cleaner_arrived', 'in_progress', 'completed'].includes(booking.status),
            icon: 'car',
          },
          {
            id: '3',
            title: 'Service Started',
            description: 'Cleaning has begun',
            completed: ['in_progress', 'completed'].includes(booking.status),
            icon: 'play',
          },
          {
            id: '4',
            title: 'Service Complete',
            description: 'All tasks completed',
            completed: booking.status === 'completed',
            icon: 'checkmark-circle',
          },
        ];

        const addressData = (booking as any).address;
        const formattedAddress = addressData
          ? [addressData.street, addressData.city, addressData.state, addressData.zip_code]
              .filter(Boolean)
              .join(', ')
          : 'Address pending';
        const resolvedAddress =
          ['confirmed', 'cleaner_en_route', 'cleaner_arrived', 'in_progress', 'completed'].includes(booking.status) && addressData
            ? formattedAddress
            : 'Address pending';

        return {
          id: booking.id,
          messagingEnabled: !!booking.messaging_enabled,
          service: (() => {
            const raw = booking.special_instructions?.split('.')[0]?.replace('Service: ', '') || '';
            const looksLikeId = /job from quote|^[0-9a-f-]{8,}/i.test(raw.trim());
            return raw && !looksLikeId ? raw : formatServiceType(booking.service_type);
          })(),
          provider: {
            id: cleaner?.id || '',
            name: cleaner?.name || 'Pending Assignment',
            avatar: cleaner?.avatar_url || '',
            rating: cleanerProfile?.rating_average || 0,
            phone: cleaner?.phone || '',
          },
          date: dateLabel,
          time: scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          duration: `${Math.floor((booking.estimated_duration || 120) / 60)} hours`,
          scheduledAt: booking.scheduled_time,
          status: uiStatus,
          progress,
          eta: uiStatus === 'active' ? 'In Progress' : uiStatus === 'completed' ? 'Completed' : 'Scheduled',
          address: resolvedAddress,
          price: booking.total_amount || 0,
          hasReview: reviewMap.has(booking.id),
          location: {
            latitude: 37.7749,
            longitude: -122.4194,
          },
          milestones,
          currentMilestone: milestones.filter(m => m.completed).length - 1,
        };
      });

      setBookings(transformedBookings);
      console.log('✅ Loaded bookings:', transformedBookings.length);
      };

      await Promise.race([fetchBookings(), timeoutPromise]);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('Load timeout')) {
        console.error('❌ Error loading bookings:', error);
      }
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  const formatServiceType = (type: string): string => {
    const types: Record<string, string> = {
      standard: 'Standard Cleaning',
      deep_clean: 'Deep Clean',
      move_out: 'Move Out Clean',
      kitchen: 'Kitchen Deep Clean',
      bathroom: 'Bathroom Clean',
    };
    return types[type] || 'Cleaning Service';
  };

  const loadJobs = useCallback(async () => {
    if (!user?.id) return;
    const res = await jobQuoteService.getCustomerJobs(user.id);
    if (res.success && res.data) setJobs(res.data);
  }, [user?.id]);

  const handleEditJob = (job: Job) => {
    setJobMenu(null);
    propNavigation.navigate('PostJob' as any, { editJob: job });
  };

  const handleCancelJob = (job: Job) => {
    setJobMenu(null);
    Alert.alert('Cancel job?', 'Pros will no longer be able to send quotes on this job.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel job',
        style: 'destructive',
        onPress: async () => {
          const res = await jobQuoteService.cancelJob(job.id);
          if (res.success) {
            loadJobs();
          } else {
            Alert.alert('Error', res.error || 'Failed to cancel job');
          }
        },
      },
    ]);
  };

  const handleRemoveJob = (job: Job) => {
    setJobMenu(null);
    const canRemove = ['booked', 'expired', 'cancelled'].includes(job.status) || new Date(job.expires_at) < new Date();
    if (!canRemove) {
      Alert.alert('Cannot remove', 'Only completed, expired, or cancelled jobs can be removed.');
      return;
    }
    Alert.alert('Remove job?', 'This permanently removes the job from your list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const res = await jobQuoteService.permanentlyDeleteJob(job.id);
          if (res.success) {
            setJobs((prev) => prev.filter((j) => j.id !== job.id));
          } else {
            Alert.alert('Error', res.error || 'Failed to remove job');
          }
        },
      },
    ]);
  };

  const loadQuotes = useCallback(async () => {
    if (!user?.id) return;
    const res = await jobQuoteService.getCustomerQuotes(user.id);
    if (res.success && res.data) setQuotes(res.data);
  }, [user?.id]);

  // Load on mount and when tab is focused - show UI immediately, load in background
  useFocusEffect(
    useCallback(() => {
      setLoading(false);
      loadBookings();
      loadJobs();
      loadQuotes();
    }, [loadBookings, loadJobs, loadQuotes])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBookings(), loadJobs(), loadQuotes()]);
    setRefreshing(false);
  }, [loadBookings, loadJobs, loadQuotes]);

  // Filter bookings based on active tab
  const filteredBookings =
    activeTab === 'upcoming'
      ? bookings.filter((b) => ['upcoming', 'active'].includes(b.status))
      : activeTab === 'history'
        ? bookings.filter((b) => b.status === 'completed')
        : [];

  const upcomingCount = bookings.filter((b) => ['upcoming', 'active'].includes(b.status)).length;

  useEffect(() => {
    // Animate progress bars
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  // Live tracking removed - no auto-navigate to mock tracking screen

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return '#3b82f6';
      case 'active': return '#047B9B';
      case 'completed': return '#10b981';
      default: return '#6b7280';
    }
  };

  const handleRefresh = () => {
    onRefresh();
  };

  const handleMessageProvider = (provider: { id: string; name: string; avatar: string }, bookingId?: string) => {
    routeToMessage({
      participant: provider,
      bookingId,
      navigation: propNavigation,
    });
  };

  const handleTrackLocation = (booking: Booking) => {
    propNavigation.navigate('LiveTracking', { bookingId: booking.id });
  };

  const handleReportIssue = (booking: Booking) => {
    Alert.alert(
      'Report Issue',
      'How would you like to report this?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Message Cleaner',
          onPress: () =>
            propNavigation.navigate('IndividualChat', {
              cleanerId: booking.provider.id,
              bookingId: booking.id,
            }),
        },
        {
          text: 'Contact Support',
          onPress: () => propNavigation.navigate('HelpScreen'),
        },
      ]
    );
  };

  const handleRateAndTip = (booking: Booking) => {
    propNavigation.navigate('TipAndReview', {
      bookingId: booking.id,
      cleanerId: booking.provider.id,
      cleanerName: booking.provider.name,
      cleanerPhoto: booking.provider.avatar,
      serviceTitle: booking.service,
      serviceCost: booking.price,
    });
  };

  const handleQuickRebook = (booking: Booking) => {
    // Pre-fill the booking flow with previous booking details
    propNavigation.navigate('UnifiedBooking', {
      cleanerId: booking.provider.id,
      serviceType: booking.service,
      // Smart defaults from previous booking
      defaultAddress: booking.address,
      preferredCleaner: booking.provider,
      // Pre-fill with same service details
      serviceId: booking.id,
      basePrice: booking.price,
    });
  };

  const handleViewReceipt = (booking: Booking) => {
    Alert.alert(
      'Receipt',
      `Your receipt for ${booking.service} is being prepared.`
    );
  };

  const handleCancelBooking = (booking: Booking) => {
    const runCancel = async (reason: string) => {
      try {
        const result = await bookingService.cancelBooking(
          booking.id,
          reason,
          'customer'
        );

        if (!result.success) {
          throw new Error(result.error || 'Cancellation failed');
        }

        const refundMsg = result.data?.refundAmount
          ? `A refund of $${result.data.refundAmount.toFixed(2)} will be processed within 3-5 business days.`
          : 'No refund applies per cancellation policy.';

        Alert.alert(
          'Booking Cancelled',
          `Your booking has been cancelled. ${refundMsg}`,
          [{ text: 'OK' }]
        );

        loadBookings();
      } catch (error) {
        console.error('Error cancelling booking:', error);
        Alert.alert('Error', 'Failed to cancel booking. Please try again.');
      }
    };

    const showReasonAndConfirm = async () => {
      const previewRes = await bookingService.getRefundPreview(booking.id, 'customer');
      const refundAmount = previewRes.success && previewRes.data ? previewRes.data.refundAmount : 0;
      const refundLine = refundAmount > 0
        ? `\n\nYou will receive $${refundAmount.toFixed(2)} refund.`
        : '\n\nNo refund applies per cancellation policy.';

      Alert.alert(
        'Cancel Booking',
        `Are you sure you want to cancel your ${booking.service} appointment on ${booking.date} at ${booking.time}?${refundLine}`,
        [
          { text: 'Keep Booking', style: 'cancel' },
          {
            text: 'Changed mind',
            onPress: () => runCancel('Changed mind'),
          },
          {
            text: 'Found cheaper option',
            onPress: () => runCancel('Found cheaper option'),
          },
          {
            text: 'Emergency',
            onPress: () => runCancel('Emergency'),
          },
          {
            text: 'Other',
            onPress: () => runCancel('Other'),
          },
        ]
      );
    };

    showReasonAndConfirm();
  };

  const handleRescheduleBooking = (booking: Booking) => {
    Alert.alert(
      'Reschedule Booking',
      'Choose how you\'d like to reschedule:',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Pick New Date & Time',
          onPress: () => {
            // Navigate to booking flow with reschedule mode
            propNavigation.navigate('UnifiedBooking', {
              cleanerId: booking.provider.id,
              serviceType: booking.service,
              defaultAddress: booking.address,
              basePrice: booking.price,
              rescheduleBookingId: booking.id,
              isReschedule: true,
            });
          },
        },
      ]
    );
  };

  const renderProgressBar = (progress: number) => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', `${progress}%`],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.progressText}>{progress}% Complete</Text>
    </View>
  );

  const renderTimelineMilestones = (milestones: Milestone[]) => (
    <View style={styles.timelineContainer}>
      {milestones.map((milestone, index) => (
        <View key={milestone.id} style={styles.timelineItem}>
          <View style={styles.timelineIconContainer}>
            <View
              style={[
                styles.timelineIcon,
                {
                  backgroundColor: milestone.completed ? '#10B981' : '#F3F4F6',
                  borderColor: milestone.completed ? '#10B981' : '#D1D5DB',
                },
              ]}
            >
              <Ionicons
                name={milestone.icon as any}
                size={12}
                color={milestone.completed ? '#FFFFFF' : '#6B7280'}
              />
            </View>
            {index < milestones.length - 1 && (
              <View
                style={[
                  styles.timelineLine,
                  { backgroundColor: milestone.completed ? '#10B981' : '#E5E7EB' },
                ]}
              />
            )}
          </View>
          <View style={styles.timelineContent}>
            <Text
              style={[
                styles.timelineStepTitle,
                { color: milestone.completed ? '#0F172A' : '#6B7280' },
              ]}
              numberOfLines={1}
            >
              {milestone.title}
            </Text>
            {milestone.description ? (
              <Text style={styles.timelineDescription} numberOfLines={1}>
                {milestone.description}
              </Text>
            ) : null}
          </View>
          {milestone.timestamp ? (
            <Text style={styles.timelineTime}>{milestone.timestamp}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );

  const renderActiveBookingMap = (booking: Booking) => (
    <View style={styles.mapContainer}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: booking.location.latitude,
          longitude: booking.location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        <Marker
          coordinate={booking.location}
          title="Your Location"
          description={booking.address}
        >
          <View style={styles.homeMarker}>
            <Ionicons name="home" size={20} color="#ffffff" />
          </View>
        </Marker>
        {booking.providerLocation && (
          <Marker
            coordinate={booking.providerLocation}
            title={`${booking.provider.name}'s Location`}
            description="Service Provider"
          >
            <View style={styles.providerMarker}>
              <Image
                source={{ uri: booking.provider.avatar }}
                style={styles.providerMarkerImage}
              />
            </View>
          </Marker>
        )}
      </MapView>
      {/* Live Track button removed - mock tracking screen until v2 */}
    </View>
  );

  const getLiveCountdown = (booking: Booking) => {
    const scheduled = new Date(booking.scheduledAt);
    const diffMinutes = Math.ceil((scheduled.getTime() - now.getTime()) / 60000);
    if (diffMinutes < 0 || diffMinutes > 60) return null;
    return `Starts in ${diffMinutes}m`;
  };

  const renderBookingCard = (booking: Booking) => {
    const liveCountdown = getLiveCountdown(booking);

    const statusVariant =
      booking.status === 'active'
        ? 'brand'
        : booking.status === 'upcoming'
          ? 'info'
          : booking.status === 'completed'
            ? 'success'
            : 'neutral';

    return (
    <Card key={booking.id} style={{ marginHorizontal: 16, marginBottom: 12 }}>
      {/* Message Icon - Only when messaging_enabled (post-payment) */}
      {booking.messagingEnabled && (
        <TouchableOpacity
          style={styles.cardMessageButton}
          onPress={() => handleMessageProvider(booking.provider, booking.id)}
        >
          <Ionicons name="chatbubble" size={16} color="#26B7C9" />
        </TouchableOpacity>
      )}

      {/* Service Header */}
      <View style={styles.bookingHeader}>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceTitle}>{booking.service}</Text>
          <View style={styles.serviceDetails}>
            <Text style={styles.serviceDate}>{booking.date}</Text>
            <Text style={styles.serviceTime}> • {booking.time}</Text>
            {liveCountdown && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveCountdown}</Text>
              </View>
            )}
            <Text style={styles.serviceDuration}> • {booking.duration}</Text>
          </View>
        </View>
        <Chip
          label={booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
          variant={statusVariant as any}
        />
      </View>

      {/* Provider Info */}
      <View style={styles.providerSection}>
        <View style={styles.providerInfo}>
          <Image source={{ uri: booking.provider.avatar }} style={styles.providerAvatar} />
          <View style={styles.providerDetails}>
            <Text style={styles.providerName}>{booking.provider.name}</Text>
            <View style={styles.providerRating}>
              <Ionicons name="star" size={12} color="#E6B200" />
              <Text style={styles.providerRatingText}>{booking.provider.rating}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Progress Section for Active Bookings */}
      {booking.status === 'active' && (
        <View style={styles.progressSection}>
          {renderProgressBar(booking.progress)}
          <View style={styles.etaContainer}>
            <Ionicons name="time" size={16} color="#26B7C9" />
            <Text style={styles.etaText}>ETA: {booking.eta}</Text>
          </View>
          {renderActiveBookingMap(booking)}
        </View>
      )}

      {/* Timeline Milestones */}
      {renderTimelineMilestones(booking.milestones)}

      {/* Address */}
      <View style={styles.addressSection}>
        <Ionicons name="location" size={16} color="#6b7280" />
        <Text style={styles.addressText}>{booking.address}</Text>
      </View>

      {/* Price */}
      <View style={styles.priceSection}>
        <Text style={styles.priceLabel}>Total</Text>
        <Text style={styles.priceAmount}>${booking.price.toFixed(2)}</Text>
      </View>

      {/* Action Buttons */}
      <View style={[styles.actionButtons, { gap: 8, marginTop: 12 }]}>
        {booking.status === 'upcoming' && (
          <>
            <Button label="Reschedule" variant="secondary" icon="calendar-outline" fullWidth style={{ flex: 1 }} onPress={() => handleRescheduleBooking(booking)} />
            <Button label="Cancel" variant="destructive" icon="close-circle-outline" style={{ flex: 1 }} onPress={() => handleCancelBooking(booking)} />
          </>
        )}
        {booking.status === 'active' && (
          <>
            <Button label="Track" variant="primary" icon="locate" style={{ flex: 1 }} onPress={() => handleTrackLocation(booking)} />
            <Button label="Report issue" variant="secondary" icon="warning" style={{ flex: 1 }} onPress={() => handleReportIssue(booking)} />
          </>
        )}
        {booking.status === 'completed' && (
          <>
            {booking.hasReview ? (
              <Button label="Receipt" variant="secondary" icon="receipt" style={{ flex: 1 }} onPress={() => handleViewReceipt(booking)} />
            ) : (
              <Button label="Rate & tip" variant="primary" icon="star" style={{ flex: 1 }} onPress={() => handleRateAndTip(booking)} />
            )}
            <Button label="Book again" variant="secondary" icon="refresh" style={{ flex: 1 }} onPress={() => handleQuickRebook(booking)} />
          </>
        )}
      </View>
    </Card>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <View style={styles.headerActions}>

          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Ionicons name="refresh" size={20} color="#26B7C9" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => propNavigation.navigate('NotificationsScreen')}
          >
            <Ionicons name="notifications-outline" size={24} color="#1C1C1E" />
            {hasUnreadNotifications && <View style={styles.notificationBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation - matches pro Jobs tab style (teal active, grey inactive) */}
      <View style={styles.tabScroll}>
        <View style={styles.tabContainer}>
          {(['my-jobs', 'quotes', 'upcoming', 'history'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const count =
              tab === 'quotes' ? quotes.length
              : tab === 'upcoming' ? upcomingCount
              : 0;
            const label = tab === 'my-jobs' ? 'Jobs' : tab === 'quotes' ? 'Quotes' : tab === 'upcoming' ? 'Scheduled' : 'History';
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, isActive && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, isActive && styles.activeTabText]} numberOfLines={1}>
                  {label}
                </Text>
                {count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
                  </View>
                )}
                {isActive && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Content with proper scroll support */}
      {/* Quick Actions - Recent Bookings for One-Tap Rebooking */}
      {activeTab === 'upcoming' && false && (
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>Quick Rebook</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickActionsScroll}>
            {bookings.filter(b => b.status === 'completed').slice(0, 3).map((booking) => (
              <TouchableOpacity
                key={`quick-${booking.id}`}
                style={styles.quickActionCard}
                onPress={() => handleQuickRebook(booking)}
              >
                <Image source={{ uri: booking.provider.avatar }} style={styles.quickActionAvatar} />
                <Text style={styles.quickActionService} numberOfLines={1}>{booking.service}</Text>
                <Text style={styles.quickActionProvider} numberOfLines={1}>{booking.provider.name}</Text>
                <View style={styles.quickActionPrice}>
                  <Ionicons name="refresh" size={12} color="#26B7C9" />
                  <Text style={styles.quickActionPriceText}>${booking.price}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#26B7C9"
            colors={['#26B7C9']}
          />
        }
      >
        {activeTab === 'my-jobs' && (
          <>
            {jobs.length > 0 ? (
              jobs.map((job) => {
                const isExpired = new Date(job.expires_at) < new Date();
                const statusLabel =
                  job.status === 'booked'
                    ? 'Booked'
                    : job.status === 'expired' || isExpired
                      ? 'Expired'
                      : job.status === 'quotes_received'
                        ? 'Quotes received'
                        : 'Waiting for quotes';
                const isOpen = job.status === 'open' && !isExpired;
                const isBooked = job.status === 'booked';
                const statusStyle = isExpired
                  ? styles.jobStatusExpired
                  : isBooked
                    ? styles.jobStatusBooked
                    : job.status === 'quotes_received'
                      ? styles.jobStatusReceived
                      : undefined;
                return (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.jobCard}
                    onPress={() => propNavigation.navigate('QuoteList' as any, { jobId: job.id })}
                    activeOpacity={0.85}
                  >
                    <View style={styles.jobCardBody}>
                      <View style={styles.jobCardTopRow}>
                        <Text style={styles.jobCardHeadline} numberOfLines={2}>{job.headline}</Text>
                        <TouchableOpacity
                          onPress={(e) => { e.stopPropagation(); setJobMenu(job); }}
                          style={styles.jobMenuBtn}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Ionicons name="ellipsis-horizontal" size={18} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.jobCardMeta}>
                        <Text style={styles.jobCardCategory}>{jobQuoteService.getCategoryLabel(job.category)}</Text>
                        <View style={[styles.jobStatusBadge, statusStyle]}>
                          <Text style={styles.jobStatusText}>{statusLabel}</Text>
                        </View>
                      </View>
                      <View style={styles.jobCardFooter}>
                        <Text style={styles.jobCardHint}>View quotes ›</Text>
                        {isOpen && (
                          <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); handleEditJob(job); }}
                            style={styles.jobEditPill}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="create-outline" size={14} color="#0F766E" />
                            <Text style={styles.jobEditPillText}>Edit</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="briefcase-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No jobs yet</Text>
                <Text style={styles.emptyStateSubtitle}>Post a job to get video quotes from pros</Text>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => propNavigation.navigate('PostJob' as any)}
                >
                  <Text style={styles.primaryButtonText}>Post a Job</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        {activeTab === 'quotes' && (
          <>
            {quotes.length > 0 ? (
              quotes.map((q) => {
                const proName = (q.pro as any)?.name || 'Pro';
                const avatarUrl = (q.pro as any)?.avatar_url;
                const rating = (q.pro as any)?.cleaner_profiles?.[0]?.rating_average ?? '—';
                return (
                  <TouchableOpacity
                    key={q.id}
                    style={styles.quoteCard}
                    onPress={() => propNavigation.navigate('QuoteList' as any, { jobId: q.job_id })}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: avatarUrl || 'https://via.placeholder.com/48' }} style={styles.quoteCardAvatar} />
                    <View style={styles.quoteCardContent}>
                      <Text style={styles.quoteCardPro}>{proName}</Text>
                      <Text style={styles.quoteCardPrice}>${(q.price_cents / 100).toFixed(0)}</Text>
                      <Text style={styles.quoteCardJob} numberOfLines={1}>{q.job?.headline || 'Job'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.quoteWatchBtn}
                      onPress={() => propNavigation.navigate('QuoteList' as any, { jobId: q.job_id })}
                    >
                      <Text style={styles.quoteWatchBtnText}>Watch & Accept</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="videocam-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>No quotes yet</Text>
                <Text style={styles.emptyStateSubtitle}>Pros will send video quotes for your jobs</Text>
                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={() => propNavigation.navigate('PostJob' as any)}
                >
                  <Text style={styles.outlineButtonText}>Post a Job</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
        {activeTab === 'upcoming' && filteredBookings.length > 0 && filteredBookings.map(renderBookingCard)}
        {activeTab === 'history' && filteredBookings.length > 0 && filteredBookings.map(renderBookingCard)}
        {(activeTab === 'upcoming' || activeTab === 'history') && filteredBookings.length === 0 ? (
          <View style={styles.emptyState}>
            {activeTab === 'upcoming' && filteredBookings.length === 0 && (
              <>
                <View style={styles.emptyIconContainer}>
                  <LinearGradient
                    colors={['#26B7C9', '#047B9B']}
                    style={styles.emptyIconGradient}
                  >
                    <Ionicons name="calendar-outline" size={64} color="#ffffff" />
                  </LinearGradient>
                </View>
                <Text style={styles.emptyStateTitle}>No upcoming services</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Ready to get your space sparkling clean? Book a service and transform your home today.
                </Text>
                {true && (
                  <View style={styles.emptyStateFeatures}>
                    <View style={styles.featureItem}>
                      <Ionicons name="flash" size={20} color="#26B7C9" />
                      <Text style={styles.featureText}>Book in 60 seconds</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="shield-checkmark" size={20} color="#26B7C9" />
                      <Text style={styles.featureText}>Verified cleaners</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="star" size={20} color="#26B7C9" />
                      <Text style={styles.featureText}>5-star guarantee</Text>
                    </View>
                  </View>
                )}

              </>
            )}
            
            {false && (
              <>
                <View style={styles.emptyIconContainer}>
                  <LinearGradient
                    colors={['#047B9B', '#0E7490']}
                    style={styles.emptyIconGradient}
                  >
                    <Ionicons name="time-outline" size={64} color="#ffffff" />
                  </LinearGradient>
                </View>
                <Text style={styles.emptyStateTitle}>No services in progress</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Your active cleanings will appear here with real-time updates and live tracking.
                </Text>
                {true && (
                  <View style={styles.emptyStateFeatures}>
                    <View style={styles.featureItem}>
                      <Ionicons name="location" size={20} color="#047B9B" />
                      <Text style={styles.featureText}>Live GPS tracking</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="chatbubble" size={20} color="#047B9B" />
                      <Text style={styles.featureText}>Direct messaging</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="camera" size={20} color="#047B9B" />
                      <Text style={styles.featureText}>Progress photos</Text>
                    </View>
                  </View>
                )}

              </>
            )}
            
            {activeTab === 'history' && filteredBookings.length === 0 && (
              <>
                <View style={styles.emptyIconContainer}>
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    style={styles.emptyIconGradient}
                  >
                    <Ionicons name="checkmark-circle-outline" size={64} color="#ffffff" />
                  </LinearGradient>
                </View>
                <Text style={styles.emptyStateTitle}>No completed services yet</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Your cleaning history will appear here once you complete your first service. Build your cleaning journey!
                </Text>
                {true && (
                  <View style={styles.emptyStateFeatures}>
                    <View style={styles.featureItem}>
                      <Ionicons name="repeat" size={20} color="#10b981" />
                      <Text style={styles.featureText}>Easy rebooking</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="heart" size={20} color="#10b981" />
                      <Text style={styles.featureText}>Save favorites</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="star" size={20} color="#10b981" />
                      <Text style={styles.featureText}>Rate & review</Text>
                    </View>
                  </View>
                )}

              </>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!jobMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setJobMenu(null)}
      >
        <TouchableOpacity
          style={styles.jobMenuOverlay}
          activeOpacity={1}
          onPress={() => setJobMenu(null)}
        >
          <View style={styles.jobMenuSheet}>
            {jobMenu && jobMenu.status === 'open' && new Date(jobMenu.expires_at) >= new Date() && (
              <>
                <TouchableOpacity style={styles.jobMenuItem} onPress={() => handleEditJob(jobMenu)}>
                  <Ionicons name="create-outline" size={20} color="#0F172A" />
                  <Text style={styles.jobMenuItemText}>Edit job</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.jobMenuItem} onPress={() => handleCancelJob(jobMenu)}>
                  <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                  <Text style={[styles.jobMenuItemText, { color: '#DC2626' }]}>Cancel job</Text>
                </TouchableOpacity>
              </>
            )}
            {jobMenu && (['booked', 'expired', 'cancelled'].includes(jobMenu.status) || new Date(jobMenu.expires_at) < new Date()) && (
              <TouchableOpacity style={styles.jobMenuItem} onPress={() => handleRemoveJob(jobMenu)}>
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
                <Text style={[styles.jobMenuItemText, { color: '#DC2626' }]}>Remove from list</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.jobMenuItem, styles.jobMenuClose]} onPress={() => setJobMenu(null)}>
              <Text style={[styles.jobMenuItemText, { color: '#64748B' }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Floating Navigation */}
      <FloatingNavigation navigation={propNavigation} currentScreen="Bookings" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
    paddingTop: hp('7.5%'),
    paddingBottom: hp('2.5%'),
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('3%'),
  },
  refreshButton: {
    padding: 8,
    borderRadius: wp('5%'),
    backgroundColor: '#F3F4F6',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    borderRadius: wp('5%'),
    backgroundColor: '#F3F4F6',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: wp('1%'),
    backgroundColor: '#FF3B30',
  },
  tabScroll: {
    marginBottom: hp('1.2%'),
    paddingHorizontal: wp('5%'),
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: hp('1.6%'),
    paddingHorizontal: wp('4%'),
    marginHorizontal: wp('4%'),
    marginBottom: hp('1.2%'),
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  jobCardBody: { flex: 1 },
  jobCardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  jobCardHeadline: { flex: 1, fontSize: 16, fontWeight: '700', color: '#0F172A', letterSpacing: -0.2 },
  jobCardMeta: { flexDirection: 'row', alignItems: 'center', gap: wp('2%'), marginTop: 6 },
  jobCardCategory: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  jobStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#E6FAFB',
  },
  jobStatusExpired: { backgroundColor: '#F1F5F9' },
  jobStatusBooked: { backgroundColor: '#DCFCE7' },
  jobStatusReceived: { backgroundColor: '#FEF3C7' },
  jobStatusText: { fontSize: 11, fontWeight: '700', color: '#0F766E' },
  jobCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  jobCardHint: { fontSize: 13, color: '#0891B2', fontWeight: '600' },
  jobEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#F0FDFA',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  jobEditPillText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  jobMenuBtn: {
    padding: 4,
    borderRadius: 8,
  },
  jobMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  jobMenuSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  jobMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderRadius: 12,
  },
  jobMenuItemText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  jobMenuClose: {
    justifyContent: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4%'),
    padding: wp('4%'),
    marginBottom: hp('2%'),
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  quoteCardAvatar: { width: 48, height: 48, borderRadius: 24, marginRight: wp('3%') },
  quoteCardContent: { flex: 1 },
  quoteCardPro: { fontSize: wp('4%'), fontWeight: '700', color: '#1F2937' },
  quoteCardPrice: { fontSize: wp('4.5%'), fontWeight: '800', color: '#26B7C9', marginTop: 2 },
  quoteCardJob: { fontSize: wp('3%'), color: '#6B7280', marginTop: 2 },
  quoteWatchBtn: {
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    backgroundColor: '#26B7C9',
    borderRadius: wp('3%'),
  },
  quoteWatchBtnText: { fontSize: wp('3.5%'), fontWeight: '700', color: '#fff' },
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
    backgroundColor: '#E6FAFB',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -2,
    left: '22%',
    right: '22%',
    height: 3,
    backgroundColor: '#26B7C9',
    borderRadius: 2,
  },
  tabText: {
    fontSize: Math.max(13, wp('3.2%')),
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabText: {
    color: '#0D9488',
    fontWeight: '700',
  },
  badgeContainer: {
    marginLeft: 6,
  },
  badge: {
    backgroundColor: '#26B7C9',
    borderRadius: wp('2.5%'),
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp('1%'),
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: wp('2.5%'),
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 140,
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('5%'),
    padding: 24,
    marginBottom: hp('2.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
    position: 'relative',
  },
  cardPhoneButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6FFFA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  cardMessageButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6FFFA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    zIndex: 10,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp('3%'),
    paddingRight: 50, // Space for phone button
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('1%'),
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceDate: {
    fontSize: wp('3.5%'),
    color: '#666666',
  },
  serviceTime: {
    fontSize: wp('3.5%'),
    color: '#666666',
  },
  liveBadge: {
    marginLeft: 8,
    paddingHorizontal: wp('2%'),
    paddingVertical: 2,
    borderRadius: wp('2.5%'),
    backgroundColor: '#EF4444',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  serviceDuration: {
    fontSize: wp('3.5%'),
    color: '#666666',
  },
  statusBadge: {
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.7%'),
    borderRadius: wp('5%'),
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: wp('3%'),
    fontWeight: '600',
  },
  providerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('3%'),
    paddingBottom: hp('3%'),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: wp('6%'),
    marginRight: 12,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  providerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerRatingText: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginLeft: 4,
  },
  providerActions: {
    flexDirection: 'row',
    gap: wp('2%'),
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6FFFA',
  },
  progressSection: {
    marginBottom: hp('3%'),
  },
  progressContainer: {
    marginBottom: hp('1.5%'),
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: wp('1%'),
    marginBottom: hp('1%'),
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#26B7C9',
    borderRadius: wp('1%'),
  },
  progressText: {
    fontSize: wp('3%'),
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('2%'),
  },
  etaText: {
    fontSize: wp('3.5%'),
    color: '#26B7C9',
    fontWeight: '600',
    marginLeft: 4,
  },
  mapContainer: {
    height: 200,
    borderRadius: wp('4%'),
    overflow: 'hidden',
    position: 'relative',
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26B7C9',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1.2%'),
    borderRadius: wp('5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  trackButtonIcon: {
    fontSize: wp('3.5%'),
    marginRight: 4,
  },
  trackButtonText: {
    color: '#FFFFFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  homeMarker: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    backgroundColor: '#26B7C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerMarker: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  providerMarkerImage: {
    width: '100%',
    height: '100%',
  },
  timelineContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timelineIconContainer: {
    alignItems: 'center',
    width: 22,
    marginRight: 10,
  },
  timelineIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  timelineLine: {
    width: 2,
    height: 18,
    marginTop: 2,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  timelineDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  timelineTime: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
    marginLeft: 8,
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
    marginLeft: 6,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  priceLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: wp('3%'),
    paddingTop: hp('1%'),
  },
  outlineButton: {
    flex: 1,
    height: 48,
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#26B7C9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: wp('1.5%'),
  },
  outlineButtonText: {
    color: '#26B7C9',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: wp('1.5%'),
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: wp('3.5%'),
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: wp('3%'),
    backgroundColor: '#26B7C9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: wp('3.5%'),
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp('8%'),
  },
  emptyStateTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('2%'),
    marginBottom: hp('1%'),
  },
  emptyStateSubtitle: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Demo Toggle Styles
  demoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    backgroundColor: '#F8FAFC',
    borderRadius: wp('3%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoToggleLabel: {
    fontSize: wp('3%'),
    fontWeight: '500',
    color: '#64748B',
    marginRight: 6,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  // Fixed Bottom Button Styles
  fixedBottomButton: {
    position: 'absolute',
    bottom: 140,
    left: 20,
    right: 20,
  },
  bookServiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#26B7C9',
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('6%'),
    borderRadius: wp('3%'),
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookServiceButtonText: {
    color: '#ffffff',
    fontSize: wp('4%'),
    fontWeight: '700',
    marginLeft: 8,
  },
  // Enhanced Empty State Styles
  emptyIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('3%'),
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: wp('15%'),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#26B7C9',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyStateFeatures: {
    marginTop: hp('3%'),
    marginBottom: hp('4%'),
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('1%'),
    backgroundColor: '#F8FAFC',
    borderRadius: wp('5%'),
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureText: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#475569',
    marginLeft: 8,
  },
  // Quick Actions Styles
  quickActionsContainer: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  quickActionsTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('1.5%'),
  },
  quickActionsScroll: {
    flexDirection: 'row',
  },
  quickActionCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: wp('3%'),
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickActionAvatar: {
    width: 40,
    height: 40,
    borderRadius: wp('5%'),
    marginBottom: hp('1%'),
  },
  quickActionService: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: hp('0.5%'),
  },
  quickActionProvider: {
    fontSize: wp('2.5%'),
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: hp('0.7%'),
  },
  quickActionPrice: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionPriceText: {
    fontSize: wp('3%'),
    fontWeight: '700',
    color: '#26B7C9',
    marginLeft: 4,
  },
});

export default BookingScreen; 