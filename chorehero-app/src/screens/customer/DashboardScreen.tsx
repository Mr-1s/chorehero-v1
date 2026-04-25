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
  RefreshControl,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useFocusEffect } from '@react-navigation/native';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { wp, hp } from '../../utils/responsive';

const { width } = Dimensions.get('window');

type StackParamList = {
  CustomerDashboard: undefined;
  BookingFlow: {
    cleanerId?: string;
    serviceType?: string;
    location?: any;
  };
  ServiceSelection: {
    cleanerId?: string;
    location?: string;
  };
  ActiveJob: { jobId: string };
  TrackingScreen: { jobId: string };
  SavedServices: undefined;
  Profile: undefined;
  SettingsScreen: undefined;
  Content: undefined;
  MessagesScreen: undefined;
  RatingsScreen: { jobId: string; type: 'complete' };
};

type CustomerDashboardProps = {
  navigation: StackNavigationProp<StackParamList, 'CustomerDashboard'>;
};

interface Booking {
  id: string;
  status: 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
  cleaner: {
    id: string;
    name: string;
    avatar: string;
    rating: number;
  };
  service: {
    type: string;
    title: string;
    duration: number;
  };
  schedule: {
    date: string;
    time: string;
  };
  location: {
    address: string;
  };
  payment: {
    total: number;
  };
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string[];
  onPress: () => void;
}

interface SavedService {
  id: string;
  title: string;
  lastUsed: string;
  frequency: string;
  price: number;
  cleanerId: string;
  cleanerName: string;
}

const CustomerDashboardScreen: React.FC<CustomerDashboardProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [savedServices, setSavedServices] = useState<SavedService[]>([]);
  const [userName, setUserName] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  // Reload when screen comes into focus (e.g. after completing a booking)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) loadDashboardData();
    }, [user?.id])
  );

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      // Set user name
      if (user?.name) {
        setUserName(user.name.split(' ')[0]);
      }

      if (!user?.id) {
        // No user - show empty state
        setUpcomingBookings([]);
        setRecentBookings([]);
        setSavedServices([]);
        setIsLoading(false);
        return;
      }

      console.log('📊 Loading dashboard for user:', user.id);

      // Fetch upcoming bookings (only paid - payment_status succeeded)
      const { data: upcomingData, error: upcomingError } = await supabase
        .from('bookings')
        .select(`
          id,
          service_type,
          status,
          scheduled_time,
          estimated_duration,
          total_amount,
          address:addresses!address_id(street, city, state, zip_code),
          special_instructions,
          cleaner_id,
          cleaner:users!bookings_cleaner_id_fkey(
            id,
            name,
            avatar_url
          )
        `)
        .eq('customer_id', user.id)
        .eq('payment_status', 'succeeded')
        .in('status', ['pending', 'confirmed', 'cleaner_en_route', 'cleaner_arrived', 'in_progress'])
        .order('scheduled_time', { ascending: true })
        .limit(5);

      if (upcomingError) {
        console.error('❌ Error fetching upcoming bookings:', upcomingError);
      }

      // Fetch cleaner profiles for ratings
      const cleanerIds = [...new Set((upcomingData || []).map((b: any) => b.cleaner_id).filter(Boolean))];
      const { data: profiles } = cleanerIds.length > 0 
        ? await supabase.from('cleaner_profiles').select('user_id, rating_average').in('user_id', cleanerIds)
        : { data: [] };
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // Transform upcoming bookings
      const transformedUpcoming: Booking[] = (upcomingData || []).map((booking: any) => {
        const scheduledDate = new Date(booking.scheduled_time);
        const now = new Date();
        const isToday = scheduledDate.toDateString() === now.toDateString();
        const isTomorrow = scheduledDate.toDateString() === new Date(now.getTime() + 86400000).toDateString();
        
        let dateLabel = scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (isToday) dateLabel = 'Today';
        else if (isTomorrow) dateLabel = 'Tomorrow';

        const cleanerProfile = profileMap.get(booking.cleaner_id);

        return {
          id: booking.id,
          status: 'upcoming' as const,
          cleaner: {
            id: booking.cleaner?.id || '',
            name: booking.cleaner?.name || 'Pending',
            avatar: booking.cleaner?.avatar_url || '',
            rating: cleanerProfile?.rating_average || 0,
          },
          service: {
            type: booking.service_type || 'standard',
            title: booking.special_instructions?.split('.')[0]?.replace('Service: ', '') || 'Cleaning Service',
            duration: booking.estimated_duration || 120,
          },
          schedule: {
            date: dateLabel,
            time: scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          location: {
            address: booking.address
              ? [booking.address.street, booking.address.city, booking.address.state, booking.address.zip_code].filter(Boolean).join(', ')
              : 'Address pending',
          },
          payment: {
            total: booking.total_amount || 0,
          },
        };
      });

      setUpcomingBookings(transformedUpcoming);

      // Fetch recent completed bookings (only paid)
      const { data: recentData } = await supabase
        .from('bookings')
        .select(`
          id,
          service_type,
          scheduled_time,
          estimated_duration,
          total_amount,
          address:addresses!address_id(street, city, state, zip_code),
          special_instructions,
          cleaner_id,
          cleaner:users!bookings_cleaner_id_fkey(
            id,
            name,
            avatar_url
          )
        `)
        .eq('customer_id', user.id)
        .eq('payment_status', 'succeeded')
        .eq('status', 'completed')
        .order('scheduled_time', { ascending: false })
        .limit(3);

      // Get profiles for recent bookings too
      const recentCleanerIds = [...new Set((recentData || []).map((b: any) => b.cleaner_id).filter(Boolean))];
      const { data: recentProfiles } = recentCleanerIds.length > 0 
        ? await supabase.from('cleaner_profiles').select('user_id, rating_average').in('user_id', recentCleanerIds)
        : { data: [] };
      const recentProfileMap = new Map((recentProfiles || []).map((p: any) => [p.user_id, p]));

      const transformedRecent: Booking[] = (recentData || []).map((booking: any) => {
        const scheduledDate = new Date(booking.scheduled_time);
        const cleanerProfile = recentProfileMap.get(booking.cleaner_id);

        return {
          id: booking.id,
          status: 'completed' as const,
          cleaner: {
            id: booking.cleaner?.id || '',
            name: booking.cleaner?.name || 'Cleaner',
            avatar: booking.cleaner?.avatar_url || '',
            rating: cleanerProfile?.rating_average || 0,
          },
          service: {
            type: booking.service_type || 'standard',
            title: booking.special_instructions?.split('.')[0]?.replace('Service: ', '') || 'Cleaning Service',
            duration: booking.estimated_duration || 120,
          },
          schedule: {
            date: scheduledDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            time: scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
          location: {
            address: booking.address
              ? [booking.address.street, booking.address.city, booking.address.state, booking.address.zip_code].filter(Boolean).join(', ')
              : '',
          },
          payment: {
            total: booking.total_amount || 0,
          },
        };
      });

      setRecentBookings(transformedRecent);

      // Set saved services from recent bookings for quick rebook
      if (transformedRecent.length > 0) {
        setSavedServices(transformedRecent.slice(0, 2).map(b => ({
          id: b.id,
          title: b.service.title,
          lastUsed: b.schedule.date,
          frequency: 'One-time',
          price: b.payment.total,
          cleanerId: b.cleaner.id,
          cleanerName: b.cleaner.name,
        })));
      } else {
        setSavedServices([]);
      }

      console.log('✅ Dashboard loaded:', {
        upcoming: transformedUpcoming.length,
        recent: transformedRecent.length,
      });
    } catch (error) {
      console.error('❌ Dashboard load error:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
      setUpcomingBookings([]);
      setRecentBookings([]);
      setSavedServices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const quickActions: QuickAction[] = [
    {
      id: 'post-job',
      title: 'Post a Job',
      subtitle: 'Get video quotes from pros',
      icon: 'videocam',
      color: ['#26B7C9', '#047B9B'],
      onPress: () => navigation.navigate('PostJob'),
    },
    {
      id: 'book',
      title: 'Book Now',
      subtitle: 'Quick 60s booking',
      icon: 'add-circle',
      color: ['#26B7C9', '#26B7C9'],
      onPress: () => navigation.navigate('BookingFlow', {}),
    },
    {
      id: 'browse',
      title: 'Browse Cleaners',
      subtitle: 'View profiles & videos',
      icon: 'people',
      color: ['#3B82F6', '#2563EB'],
      onPress: () => navigation.navigate('Content' as never),
    },
    {
      id: 'my-jobs',
      title: 'My Jobs',
      subtitle: 'View your quote requests',
      icon: 'document-text',
      color: ['#8B5CF6', '#7C3AED'],
      onPress: () => navigation.navigate('MyJobs'),
    },
    {
      id: 'saved',
      title: 'Saved Services',
      subtitle: 'Your favorites',
      icon: 'heart',
      color: ['#EC4899', '#DB2777'],
      onPress: () => navigation.navigate('SavedServices'),
    },
    {
      id: 'emergency',
      title: 'Emergency Clean',
      subtitle: 'ASAP booking',
      icon: 'flash',
      color: ['#F59E0B', '#D97706'],
      onPress: () => navigation.navigate('BookingFlow', { serviceType: 'express' }),
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return '#3B82F6';
      case 'in_progress': return '#26B7C9';
      case 'completed': return '#059669';
      case 'cancelled': return '#DC2626';
      default: return '#6B7280';
    }
  };

  const getServiceTypeColor = (type: string) => {
    switch (type) {
      case 'express': return 'rgba(59, 130, 246, 0.15)';
      case 'standard': return 'rgba(245, 158, 11, 0.15)';
      case 'deep': return 'rgba(139, 92, 246, 0.15)';
      default: return '#6B7280';
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>Good afternoon, {userName}! ☀️</Text>
          <Text style={styles.greetingSubtext}>Ready for a sparkling clean home?</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>J</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.quickActionCard}
            onPress={action.onPress}
          >
            <LinearGradient
              colors={action.color}
              style={styles.quickActionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={action.icon as any} size={24} color="#FFFFFF" />
              <Text style={styles.quickActionTitle}>{action.title}</Text>
              <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderBookingCard = (booking: Booking, showActions = true) => (
    <TouchableOpacity
      key={booking.id}
      style={styles.bookingCard}
      onPress={() => {
        if (booking.status === 'upcoming' || booking.status === 'in_progress') {
          navigation.navigate('ActiveJob', { jobId: booking.id });
        } else if (booking.status === 'completed') {
          navigation.navigate('RatingsScreen', { jobId: booking.id, type: 'complete' });
        }
      }}
    >
      <View style={styles.bookingHeader}>
        <View style={styles.bookingHeaderLeft}>
          <Image source={{ uri: booking.cleaner.avatar }} style={styles.cleanerAvatar} />
          <View style={styles.bookingInfo}>
            <Text style={styles.cleanerName}>{booking.cleaner.name}</Text>
            <View style={styles.serviceInfo}>
              <View style={[
                styles.serviceTypeBadge,
                { backgroundColor: getServiceTypeColor(booking.service.type) }
              ]}>
                <Text style={styles.serviceTypeText}>{booking?.service?.title || booking?.service?.name || 'Service'}</Text>
              </View>
              <View style={styles.cleanerRating}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.ratingText}>{booking.cleaner.rating}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(booking.status) }
        ]}>
          <Text style={styles.statusText}>{booking.status.replace('_', ' ')}</Text>
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{booking.schedule.date} at {booking.schedule.time}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{booking.service.duration} minutes</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="location-outline" size={16} color="#6B7280" />
          <Text style={styles.detailText}>{booking.location.address}</Text>
        </View>
      </View>

      <View style={styles.bookingFooter}>
        <Text style={styles.bookingPrice}>${booking.payment.total.toFixed(2)}</Text>
        {showActions && booking.status === 'upcoming' && (
          <View style={styles.bookingActions}>
            <TouchableOpacity 
              style={styles.actionButtonSecondary}
              onPress={() => Alert.alert('Reschedule', 'Reschedule functionality not yet implemented')}
            >
              <Ionicons name="calendar" size={14} color="#26B7C9" />
              <Text style={styles.actionButtonSecondaryText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButtonPrimary}
              onPress={() => navigation.navigate('TrackingScreen', { jobId: booking.id })}
            >
              <Ionicons name="location" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonPrimaryText}>Track</Text>
            </TouchableOpacity>
          </View>
        )}
        {showActions && booking.status === 'completed' && (
          <TouchableOpacity 
            style={styles.actionButtonSecondary}
            onPress={() => navigation.navigate('BookingFlow', { cleanerId: booking.cleaner.id })}
          >
            <Ionicons name="repeat" size={14} color="#26B7C9" />
            <Text style={styles.actionButtonSecondaryText}>Book Again</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderUpcomingBookings = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
          <Text style={styles.sectionLink}>View All</Text>
        </TouchableOpacity>
      </View>
      {upcomingBookings.length > 0 ? (
        upcomingBookings.slice(0, 2).map(booking => renderBookingCard(booking))
      ) : (
        <EmptyState
          {...EmptyStateConfigs.upcomingBookings}
          showFeatures={true}
          actions={[
            {
              label: 'Book Now',
              onPress: () => navigation.navigate('BookingFlow', {}),
              icon: 'add',
              primary: true,
            },
            {
              label: 'Browse Cleaners',
              onPress: () => navigation.navigate('Content'),
              icon: 'people',
              primary: false,
            },
          ]}
        />
      )}
    </View>
  );

  const renderSavedServices = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Favorites</Text>
        <TouchableOpacity onPress={() => navigation.navigate('SavedServices')}>
          <Text style={styles.sectionLink}>View All</Text>
        </TouchableOpacity>
      </View>
      {savedServices.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedServicesScroll}>
          {savedServices.map((service) => (
            <TouchableOpacity
              key={service.id}
              style={styles.savedServiceCard}
              onPress={() => navigation.navigate('BookingFlow', { cleanerId: service.cleanerId })}
            >
              <View style={styles.savedServiceHeader}>
                <Text style={styles.savedServiceTitle}>{service?.title || service?.name || 'Service'}</Text>
                <View style={styles.frequencyBadge}>
                  <Text style={styles.frequencyText}>{service.frequency}</Text>
                </View>
              </View>
              <Text style={styles.savedServiceCleaner}>with {service.cleanerName}</Text>
              <Text style={styles.savedServiceMeta}>Last used {service.lastUsed}</Text>
              <View style={styles.savedServiceFooter}>
                <Text style={styles.savedServicePrice}>${service.price.toFixed(2)}</Text>
                <TouchableOpacity style={styles.bookAgainButton}>
                  <Ionicons name="repeat" size={12} color="#26B7C9" />
                  <Text style={styles.bookAgainText}>Book</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <EmptyState
          {...EmptyStateConfigs.savedServices}
          showFeatures={true}
          actions={[
            {
              label: 'Explore Services',
              onPress: () => navigation.navigate('Content'),
              icon: 'compass',
              primary: true,
            },
          ]}
        />
      )}
    </View>
  );

  const renderRecentActivity = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={() => Alert.alert('View All', 'View all activity functionality not yet implemented')}>
          <Text style={styles.sectionLink}>View All</Text>
        </TouchableOpacity>
      </View>
      {recentBookings.length > 0 ? (
        recentBookings.slice(0, 2).map(booking => renderBookingCard(booking, false))
      ) : (
        <EmptyState
          {...EmptyStateConfigs.recentActivity}
          showFeatures={true}
          actions={[
            {
              label: 'Book Your First Service',
              onPress: () => navigation.navigate('BookingFlow', {}),
              icon: 'add-circle',
              primary: true,
            },
          ]}
        />
      )}
    </View>
  );

  const renderFloatingActions = () => (
    <View style={styles.floatingActions}>
      <TouchableOpacity 
        style={styles.floatingButton}
        onPress={() => navigation.navigate('MessagesScreen')}
      >
        <Ionicons name="chatbubble" size={24} color="#FFFFFF" />
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationText}>2</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#26B7C9" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderQuickActions()}
        {renderUpcomingBookings()}
        {renderSavedServices()}
        {renderRecentActivity()}
      </ScrollView>

      {renderFloatingActions()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2.5%'),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    flex: 1,
  },
  greetingText: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  greetingSubtext: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
  },
  profileButton: {
    marginLeft: 16,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: '#26B7C9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('3%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionLink: {
    fontSize: wp('3.5%'),
    fontWeight: '500',
    color: '#26B7C9',
  },
  quickActionsContainer: {
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('3%'),
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp('3%'),
  },
  quickActionCard: {
    width: (width - 56) / 2,
    borderRadius: wp('4%'),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  quickActionTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: hp('1%'),
    marginBottom: 2,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4%'),
    padding: 20,
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp('2%'),
  },
  bookingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cleanerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  cleanerName: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('0.7%'),
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  serviceTypeBadge: {
    borderRadius: wp('2%'),
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
  },
  serviceTypeText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cleanerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: wp('3%'),
    color: '#F59E0B',
    marginLeft: 2,
  },
  statusBadge: {
    borderRadius: wp('3%'),
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
  },
  statusText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  bookingDetails: {
    gap: wp('2%'),
    marginBottom: hp('2%'),
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginLeft: 8,
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingPrice: {
    fontSize: wp('4.5%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  bookingActions: {
    flexDirection: 'row',
    gap: wp('2%'),
  },
  actionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#26B7C9',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    gap: wp('1%'),
  },
  actionButtonPrimaryText: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1%'),
    gap: wp('1%'),
  },
  actionButtonSecondaryText: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: '#26B7C9',
  },
  savedServicesScroll: {
    paddingRight: wp('5%'),
  },
  savedServiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4%'),
    padding: 16,
    marginRight: 12,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  savedServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp('1%'),
  },
  savedServiceTitle: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  frequencyBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: wp('2%'),
    paddingHorizontal: wp('1.5%'),
    paddingVertical: 2,
  },
  frequencyText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#6B7280',
  },
  savedServiceCleaner: {
    fontSize: wp('3%'),
    color: '#6B7280',
    marginBottom: hp('0.5%'),
  },
  savedServiceMeta: {
    fontSize: wp('2.5%'),
    color: '#9CA3AF',
    marginBottom: hp('1.5%'),
  },
  savedServiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedServicePrice: {
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  bookAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: wp('2%'),
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    gap: wp('1%'),
  },
  bookAgainText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    color: '#26B7C9',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: hp('5%'),
  },
  emptyStateText: {
    fontSize: wp('4%'),
    fontWeight: '600',
    color: '#374151',
    marginTop: hp('1.5%'),
    marginBottom: hp('0.5%'),
  },
  emptyStateSubtext: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('2%'),
  },
  emptyStateButton: {
    backgroundColor: '#26B7C9',
    borderRadius: wp('3%'),
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
  },
  emptyStateButtonText: {
    fontSize: wp('3.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  floatingActions: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: wp('7%'),
    backgroundColor: '#26B7C9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: wp('2.5%'),
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationText: {
    fontSize: wp('2.5%'),
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CustomerDashboardScreen; 