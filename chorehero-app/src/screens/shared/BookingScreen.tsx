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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import FloatingNavigation from '../../components/FloatingNavigation';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { notificationService } from '../../services/notificationService';
import { bookingService } from '../../services/booking';

import { routeToMessage } from '../../utils/messageRouting';

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
  BookingConfirmation: {
    bookingId: string;
    service: {
      title: string;
      duration: string;
      price: number;
    };
    cleaner: {
      id: string;
      name: string;
      avatar: string;
      rating: number;
      eta: string;
    };
    address: string;
    scheduledTime: string;
  };
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
      activeTab?: 'upcoming' | 'active' | 'completed';
      bookingId?: string;
      showTracking?: boolean;
    };
  };
}

const { width, height } = Dimensions.get('window');

interface Booking {
  id: string;
  service: string;
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
  const initialTab = params.activeTab || 'upcoming';
  const targetBookingId = params.bookingId;
  const shouldShowTracking = params.showTracking;
  
  // Debug navigation
  console.log('Navigation object:', navigation);
  console.log('Navigation canGoBack:', navigation.canGoBack());
  console.log('Route params:', params);
  
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'completed'>(initialTab);
  const [animatedValue] = useState(new Animated.Value(0));
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Load real bookings from database
  const loadBookings = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      console.log('📅 Loading bookings for user:', user.id);
      
      const { data: rawBookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          service_type,
          status,
          scheduled_time,
          estimated_duration,
          total_amount,
          special_requests,
          created_at,
          cleaner_id,
          address:addresses(street, city, state, zip_code)
        `)
        .eq('customer_id', user.id)
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
          service: booking.special_requests?.split('.')[0]?.replace('Service: ', '') || 
                   formatServiceType(booking.service_type),
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
    } catch (error) {
      console.error('❌ Error loading bookings:', error);
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

  // Load bookings on mount and when tab is focused
  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  // Filter bookings based on active tab
  const filteredBookings = bookings.filter(b => b.status === activeTab);

  useEffect(() => {
    // Animate progress bars
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  // Handle tracking display when navigated from confirmation
  useEffect(() => {
    if (shouldShowTracking && targetBookingId) {
      // Show GPS tracking for the specific booking
      console.log('🗺️ Showing GPS tracking for booking:', targetBookingId);
      // Navigate to LiveTracking screen
      setTimeout(() => {
        navigation.navigate('LiveTracking', { bookingId: targetBookingId });
      }, 500); // Small delay to allow tab to load
    }
  }, [shouldShowTracking, targetBookingId, navigation]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return '#3b82f6';
      case 'active': return '#0891b2';
      case 'completed': return '#10b981';
      default: return '#6b7280';
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  const handleMessageProvider = (provider: { id: string; name: string; avatar: string }, bookingId?: string) => {
    routeToMessage({
      participant: provider,
      bookingId,
      navigation: propNavigation,
    });
  };

  const handleTrackLocation = (booking: Booking) => {
    navigation.navigate('LiveTracking', { bookingId: booking.id });
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
    propNavigation.navigate('NewBookingFlow', {
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
    Alert.alert(
      'Cancel Booking',
      `Are you sure you want to cancel your ${booking.service} appointment on ${booking.date} at ${booking.time}?\n\nCancellation policy: Full refund if cancelled 24+ hours before scheduled time.`,
      [
        {
          text: 'Keep Booking',
          style: 'cancel',
        },
        {
          text: 'Cancel Booking',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await bookingService.cancelBooking(
                booking.id,
                'Cancelled by customer',
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
          },
        },
      ]
    );
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
            propNavigation.navigate('NewBookingFlow', {
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
      <Text style={styles.timelineTitle}>Service Progress</Text>
      {milestones.map((milestone, index) => (
        <View key={milestone.id} style={styles.timelineItem}>
          <View style={styles.timelineIconContainer}>
            <View style={[
              styles.timelineIcon,
              { 
                backgroundColor: milestone.completed ? '#10B981' : '#F3F4F6',
                borderColor: milestone.completed ? '#10B981' : '#D1D5DB'
              }
            ]}>
              <Ionicons
                name={milestone.icon as any}
                size={18}
                color={milestone.completed ? '#FFFFFF' : '#6B7280'}
              />
            </View>
            {index < milestones.length - 1 && (
              <View style={[
                styles.timelineLine,
                { backgroundColor: milestone.completed ? '#10B981' : '#E5E7EB' }
              ]} />
            )}
          </View>
          <View style={styles.timelineContent}>
            <Text style={[
              styles.timelineStepTitle,
              { color: milestone.completed ? '#1F2937' : '#6B7280' }
            ]}>
              {milestone.title}
            </Text>
            <Text style={styles.timelineDescription}>
              {milestone.description}
            </Text>
            {milestone.timestamp && (
              <Text style={styles.timelineTime}>{milestone.timestamp}</Text>
            )}
          </View>
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
      <View style={styles.mapOverlay}>
        <TouchableOpacity
          style={styles.trackButton}
          onPress={() => handleTrackLocation(booking)}
        >
          <Text style={styles.trackButtonIcon}>📍</Text>
          <Text style={styles.trackButtonText}>Live Track</Text>
        </TouchableOpacity>
      </View>
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

    return (
    <View key={booking.id} style={styles.bookingCard}>
      {/* Message Icon - Positioned in top-right corner */}
      <TouchableOpacity
        style={styles.cardMessageButton}
        onPress={() => handleMessageProvider(booking.provider, booking.id)}
      >
        <Ionicons name="chatbubble" size={16} color="#3ad3db" />
      </TouchableOpacity>

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
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
          <Text style={styles.statusText}>{booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}</Text>
        </View>
      </View>

      {/* Provider Info */}
      <View style={styles.providerSection}>
        <View style={styles.providerInfo}>
          <Image source={{ uri: booking.provider.avatar }} style={styles.providerAvatar} />
          <View style={styles.providerDetails}>
            <Text style={styles.providerName}>{booking.provider.name}</Text>
            <View style={styles.providerRating}>
              <Ionicons name="star" size={12} color="#fbbf24" />
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
            <Ionicons name="time" size={16} color="#3ad3db" />
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
      <View style={styles.actionButtons}>
        {booking.status === 'upcoming' && (
          <>
            <TouchableOpacity 
              style={styles.outlineButton}
              onPress={() => handleRescheduleBooking(booking)}
            >
              <Ionicons name="calendar-outline" size={16} color="#3ad3db" />
              <Text style={styles.outlineButtonText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => handleCancelBooking(booking)}
            >
              <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
        {booking.status === 'active' && (
          <TouchableOpacity style={styles.primaryButton}>
            <Ionicons name="warning" size={16} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Report Issue</Text>
          </TouchableOpacity>
        )}
        {booking.status === 'completed' && (
          <>
            {booking.hasReview ? (
              <TouchableOpacity 
                style={styles.outlineButton}
                onPress={() => handleViewReceipt(booking)}
              >
                <Ionicons name="receipt" size={16} color="#26B7C9" />
                <Text style={styles.outlineButtonText}>View Receipt</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.primaryButton}
                onPress={() => handleRateAndTip(booking)}
              >
                <Ionicons name="star" size={16} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Rate & Tip</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.outlineButton}
              onPress={() => handleQuickRebook(booking)}
            >
              <Ionicons name="refresh" size={16} color="#26B7C9" />
              <Text style={styles.outlineButtonText}>Book Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
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
            <Ionicons name="refresh" size={20} color="#3ad3db" />
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

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
            Upcoming
          </Text>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                0
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.activeTab]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.activeTabText]}>
            Active
          </Text>
          <View style={styles.badgeContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                0
              </Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed
          </Text>
        </TouchableOpacity>
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
                  <Ionicons name="refresh" size={12} color="#3ad3db" />
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
      >
        {filteredBookings.length > 0 ? (
          filteredBookings.map(renderBookingCard)
        ) : (
          <View style={styles.emptyState}>
            {activeTab === 'upcoming' && (
              <>
                <View style={styles.emptyIconContainer}>
                  <LinearGradient
                    colors={['#3ad3db', '#2BC8D4']}
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
                      <Ionicons name="flash" size={20} color="#3ad3db" />
                      <Text style={styles.featureText}>Book in 60 seconds</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="shield-checkmark" size={20} color="#3ad3db" />
                      <Text style={styles.featureText}>Verified cleaners</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="star" size={20} color="#3ad3db" />
                      <Text style={styles.featureText}>5-star guarantee</Text>
                    </View>
                  </View>
                )}

              </>
            )}
            
            {activeTab === 'active' && (
              <>
                <View style={styles.emptyIconContainer}>
                  <LinearGradient
                    colors={['#0891b2', '#0E7490']}
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
                      <Ionicons name="location" size={20} color="#0891b2" />
                      <Text style={styles.featureText}>Live GPS tracking</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="chatbubble" size={20} color="#0891b2" />
                      <Text style={styles.featureText}>Direct messaging</Text>
                    </View>
                    <View style={styles.featureItem}>
                      <Ionicons name="camera" size={20} color="#0891b2" />
                      <Text style={styles.featureText}>Progress photos</Text>
                    </View>
                  </View>
                )}

              </>
            )}
            
            {activeTab === 'completed' && (
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
        )}
      </ScrollView>

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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: 'rgba(58, 211, 219, 0.12)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3ad3db',
    fontWeight: '700',
  },
  badgeContainer: {
    marginLeft: 6,
  },
  badge: {
    backgroundColor: '#3ad3db',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 140, // Extra padding to account for bottom nav
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
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
    borderRadius: 20,
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
    borderRadius: 20,
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
    marginBottom: 24,
    paddingRight: 50, // Space for phone button
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceDate: {
    fontSize: 14,
    color: '#666666',
  },
  serviceTime: {
    fontSize: 14,
    color: '#666666',
  },
  liveBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#EF4444',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  serviceDuration: {
    fontSize: 14,
    color: '#666666',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  providerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
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
    borderRadius: 24,
    marginRight: 12,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  providerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerRatingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  providerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6FFFA',
  },
  progressSection: {
    marginBottom: 24,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3ad3db',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  etaText: {
    fontSize: 14,
    color: '#3ad3db',
    fontWeight: '600',
    marginLeft: 4,
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
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
    backgroundColor: '#3ad3db',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  trackButtonIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  trackButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  homeMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3ad3db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  providerMarkerImage: {
    width: '100%',
    height: '100%',
  },
  timelineContainer: {
    marginBottom: 24,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  timelineLine: {
    width: 2,
    height: 40,
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  timelineDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
    lineHeight: 20,
  },
  timelineTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  addressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  addressText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
    lineHeight: 20,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  priceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3ad3db',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  outlineButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26B7C9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  outlineButtonText: {
    color: '#26B7C9',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
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
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Demo Toggle Styles
  demoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demoToggleLabel: {
    fontSize: 12,
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
    backgroundColor: '#3ad3db',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookServiceButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  // Enhanced Empty State Styles
  emptyIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyStateFeatures: {
    marginTop: 24,
    marginBottom: 32,
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginLeft: 8,
  },
  // Quick Actions Styles
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  quickActionsScroll: {
    flexDirection: 'row',
  },
  quickActionCard: {
    width: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    borderRadius: 20,
    marginBottom: 8,
  },
  quickActionService: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionProvider: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 6,
  },
  quickActionPrice: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3ad3db',
    marginLeft: 4,
  },
});

export default BookingScreen; 