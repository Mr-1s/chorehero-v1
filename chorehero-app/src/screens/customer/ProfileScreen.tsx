import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';
import { userStatsService } from '../../services/userStatsService';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import FloatingNavigation from '../../components/FloatingNavigation';

const { width } = Dimensions.get('window');

// Navigation types
type StackParamList = {
  Home: undefined;
  Content: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  SettingsScreen: undefined;
  PaymentScreen: { fromBooking?: boolean };
  NotificationsScreen: undefined;
  HelpScreen: undefined;
  PrivacyScreen: undefined;
  AboutScreen: undefined;
  BookingFlow: { cleanerId?: string };
  VideoFeedScreen: undefined;
  ActiveJob: { jobId: string };
  RatingsScreen: { jobId: string; type: 'complete' };
};

type ProfileScreenProps = {
  navigation: StackNavigationProp<StackParamList, 'Profile'>;
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

interface UserStats {
  totalBookings: number;
  completedBookings: number;
  totalSpent: number;
  favoriteCleaners: number;
}

const CustomerProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const { user, signOut, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
    totalBookings: 0,
    completedBookings: 0,
    totalSpent: 0,
    favoriteCleaners: 0,
  });
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [isLastProFavorite, setIsLastProFavorite] = useState(false);

  const lastProBooking = recentBookings[0] || upcomingBookings[0];
  const lastProName = lastProBooking?.cleaner?.name?.trim();
  const hasLastPro = Boolean(lastProName);
  const lastProId = lastProBooking?.cleaner?.id;

  useEffect(() => {
    const loadFavorites = async () => {
      if (!lastProId) {
        setIsLastProFavorite(false);
        return;
      }
      try {
        const raw = await AsyncStorage.getItem('favorite_cleaners');
        const list: string[] = raw ? JSON.parse(raw) : [];
        setIsLastProFavorite(list.includes(lastProId));
      } catch {
        setIsLastProFavorite(false);
      }
    };
    loadFavorites();
  }, [lastProId]);

  const toggleLastProFavorite = async () => {
    if (!lastProId) return;
    try {
      const raw = await AsyncStorage.getItem('favorite_cleaners');
      const list: string[] = raw ? JSON.parse(raw) : [];
      let next: string[];
      if (list.includes(lastProId)) {
        next = list.filter(id => id !== lastProId);
        setIsLastProFavorite(false);
      } else {
        next = [...list, lastProId];
        setIsLastProFavorite(true);
      }
      await AsyncStorage.setItem('favorite_cleaners', JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    loadProfileData();
  }, []);

  // Keep local avatar preview in sync with authenticated user
  useEffect(() => {
    if (user?.avatar_url) {
      setAvatarUri(user.avatar_url);
    }
  }, [user?.avatar_url]);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);

      // Check if user is authenticated and try to load real data
      if (user?.id && !user.id.startsWith('demo_')) {
        try {
          // Real authenticated user - load their actual data from database
          console.log('✅ REAL USER detected - loading actual data for:', user.email, user.name, 'ID:', user.id);
          
          // Load real statistics from database
          const [statsResult, upcomingResult, recentResult] = await Promise.all([
            userStatsService.getCustomerStats(user.id),
            userStatsService.getCustomerUpcomingBookings(user.id),
            userStatsService.getCustomerRecentActivity(user.id, 5)
          ]);

          // Use real data if available, fall back to empty states
          const realStats = statsResult.success ? statsResult.data! : {
            totalBookings: 0,
            completedBookings: 0,
            totalSpent: 0,
            favoriteCleaners: 0,
          };

          const realUpcoming = upcomingResult.success ? upcomingResult.data! : [];
          const realRecent = recentResult.success ? recentResult.data! : [];

          setUserStats(realStats);
          setUpcomingBookings(realUpcoming);
          setRecentBookings(realRecent);

          console.log('📊 Loaded real user statistics:', realStats);
          
        } catch (dbError) {
          console.error('Database error loading profile data:', dbError);
          // Fall back to mock data
          loadMockData();
        }
             } else {
         // No authenticated user or demo user, use mock data
         console.log('🎭 DEMO/NO USER detected - loading mock data for:', user?.email || 'no user', 'ID:', user?.id || 'none');
         loadMockData();
       }
    } catch (error) {
      console.error('Profile load error:', error);
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    // Empty state data - user has no bookings yet
    const mockStats = {
      totalBookings: 0,
      completedBookings: 0,
      totalSpent: 0,
      favoriteCleaners: 0,
    };

    // Empty arrays - no mock bookings
    const mockUpcoming: Booking[] = [];

    const mockRecent: Booking[] = [];

    // Set empty state
    setUserStats(mockStats);
    setUpcomingBookings(mockUpcoming);
    setRecentBookings(mockRecent);
  };

  // Mock data removed - app now uses real database data

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
  };

  const getServiceTypeColor = (type: string) => {
    const colors = {
      kitchen: '#F59E0B',
      bathroom: '#3B82F6',
      bedroom: '#EC4899',
      living: '#10B981',
      office: '#8B5CF6',
      deep: '#EF4444',
    };
    return colors[type as keyof typeof colors] || '#6B7280';
  };

  const getStatusColor = (status: string) => {
    const colors = {
      upcoming: '#F59E0B',
      in_progress: '#3B82F6',
      completed: '#10B981',
      cancelled: '#EF4444',
    };
    return colors[status as keyof typeof colors] || '#6B7280';
  };

  const renderProfileHeader = () => (
    <View style={styles.profileHeader}>
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF']}
        style={styles.profileGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.profileHeaderContent}>
          <View style={styles.profileInfo}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleChangeAvatar}
              style={styles.profileAvatar}
            >
              {avatarUri ? (
                <Image
                  source={{ uri: avatarUri }}
                  style={styles.profileAvatarImage}
                  onError={() => setAvatarUri(null)}
                />
              ) : (
                <Text style={styles.profileAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : (user?.email?.[0]?.toUpperCase() || 'U')}
                </Text>
              )}
            </TouchableOpacity>
            <View style={styles.profileDetails}>
              <Text style={styles.profileName}>
                {user?.name?.trim() || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={styles.profileEmail}>
                {user?.username ? `@${user.username}` : (user?.email || 'guest@chorehero.com')}
              </Text>
              <View style={styles.memberSince}>
                <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                <Text style={styles.memberSinceText}>
                  {user?.id && !user.id.startsWith('demo_') 
                    ? `Member since ${new Date(user.created_at || '').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` 
                    : 'Demo Mode • Limited features'}
                </Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('SettingsScreen')}
          >
            <Ionicons name="settings-outline" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const renderUserStats = () => (
    <View style={styles.performanceSection}>
      <Text style={styles.performanceTitle}>Performance</Text>
      <View style={styles.performanceRow}>
        <View style={styles.performanceItem}>
          <Text style={styles.performanceNumber}>{userStats.totalBookings}</Text>
          <Text style={styles.performanceLabel}>Total Bookings</Text>
        </View>
        <View style={styles.performanceDivider} />
        <View style={styles.performanceItem}>
          <Text style={styles.performanceNumber}>${userStats.totalSpent.toFixed(0)}</Text>
          <Text style={styles.performanceLabel}>Total Spent</Text>
        </View>
      </View>
    </View>
  );

  const renderQuickActions = () => {
    const primaryAction = {
      id: 'emergency',
      title: 'Emergency Clean',
      subtitle: 'ASAP booking',
      icon: 'flash',
      onPress: () => navigation.navigate('BookingFlow', {}),
    };
    const secondaryActions = [
      hasLastPro
        ? {
            id: 'rebook',
            title: `Rebook ${lastProName}`,
            subtitle: 'Repeat your last service',
            icon: 'repeat',
            onPress: () =>
              navigation.navigate('BookingFlow', { cleanerId: lastProBooking?.cleaner?.id }),
          }
        : {
            id: 'refer',
            title: 'Refer a Friend',
            subtitle: 'Get $20 for each Hero referral',
            icon: 'gift',
            onPress: () => Alert.alert('Refer a Friend', 'Invite link coming soon!'),
          },
      {
        id: 'service-history',
        title: 'Service History',
        subtitle: 'Past appointments',
        icon: 'time',
        onPress: () => navigation.navigate('Bookings'),
      },
      ...(hasLastPro
        ? [
            {
              id: 'refer',
              title: 'Refer a Friend',
              subtitle: 'Get $20 for each Hero referral',
              icon: 'gift',
              onPress: () => Alert.alert('Refer a Friend', 'Invite link coming soon!'),
            },
          ]
        : []),
      {
        id: 'favorites',
        title: 'My Favorites',
        subtitle: 'Saved cleaners',
        icon: 'heart',
        onPress: () => Alert.alert('Favorites', 'Feature coming soon!'),
      },
    ];
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity
            key={primaryAction.id}
            style={[styles.quickActionCard, styles.quickActionPrimary]}
            onPress={primaryAction.onPress}
          >
            <View style={styles.quickActionContent}>
              <Ionicons name={primaryAction.icon as any} size={22} color="#26B7C9" />
              <View style={styles.quickActionTextStack}>
                <Text style={styles.quickActionTitle}>{primaryAction.title}</Text>
                <Text style={styles.quickActionSubtitle}>{primaryAction.subtitle}</Text>
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.quickActionsRow}>
            {secondaryActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={[styles.quickActionCard, styles.quickActionSecondary]}
                onPress={action.onPress}
              >
                {action.id === 'rebook' && hasLastPro && (
                  <TouchableOpacity
                    style={styles.favoriteToggle}
                    onPress={toggleLastProFavorite}
                    accessibilityLabel="Toggle favorite cleaner"
                  >
                    <Ionicons
                      name={isLastProFavorite ? 'heart' : 'heart-outline'}
                      size={16}
                      color="#26B7C9"
                    />
                  </TouchableOpacity>
                )}
                <View style={styles.quickActionContent}>
                  <Ionicons name={action.icon as any} size={20} color="#26B7C9" />
                  <View style={styles.quickActionTextStack}>
                    <Text style={styles.quickActionTitle}>{action.title}</Text>
                    <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderBookingCard = (booking: Booking) => (
    <TouchableOpacity
      key={booking?.id || Math.random().toString()}
      style={styles.bookingCard}
      onPress={() => {
        if (!booking?.id) return;
        if (booking?.status === 'upcoming' || booking?.status === 'in_progress') {
          navigation.navigate('ActiveJob', { jobId: booking.id });
        } else if (booking?.status === 'completed') {
          navigation.navigate('RatingsScreen', { jobId: booking.id, type: 'complete' });
        }
      }}
    >
      <View style={styles.bookingHeader}>
        {booking?.cleaner?.avatar ? (
          <Image source={{ uri: booking.cleaner.avatar }} style={styles.cleanerAvatar} />
        ) : (
          <View style={[styles.cleanerAvatar, { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="person" size={20} color="#9CA3AF" />
          </View>
        )}
        <View style={styles.bookingInfo}>
          <Text style={styles.cleanerName}>{booking?.cleaner?.name || 'Cleaner'}</Text>
          <Text style={styles.serviceTitle}>{booking?.service?.title || booking?.service?.name || 'Service'}</Text>
          <Text style={styles.bookingDate}>{booking?.schedule?.date || 'Date TBD'} at {booking?.schedule?.time || 'Time TBD'}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking?.status || 'pending') }]}>
          <Text style={styles.statusText}>{booking?.status || 'pending'}</Text>
        </View>
      </View>
      <View style={styles.bookingFooter}>
        <Text style={styles.bookingPrice}>${(booking?.payment?.total || 0).toFixed(2)}</Text>
        {booking?.status === 'completed' && booking?.cleaner?.id && (
          <TouchableOpacity 
            style={styles.rebookButton}
            onPress={() => navigation.navigate('BookingFlow', { cleanerId: booking.cleaner.id })}
          >
            <Ionicons name="repeat" size={16} color="#3ad3db" />
            <Text style={styles.rebookText}>Book Again</Text>
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
        upcomingBookings.slice(0, 2).map(renderBookingCard)
      ) : (
        <EmptyState
          {...EmptyStateConfigs.upcomingBookings}
          actions={[
            {
              label: 'Book Now',
              onPress: () => navigation.navigate('BookingFlow', {}),
              icon: 'add',
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
        <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
          <Text style={styles.sectionLink}>View All</Text>
        </TouchableOpacity>
      </View>
      {recentBookings.length > 0 ? (
        recentBookings.slice(0, 1).map(renderBookingCard)
      ) : (
        <EmptyState
          {...EmptyStateConfigs.recentActivity}
          actions={[
            {
              label: 'Book Service',
              onPress: () => navigation.navigate('BookingFlow', {}),
              icon: 'add-circle',
              primary: true,
            },
          ]}
        />
      )}
    </View>
  );

  const renderAccountManagement = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account Management</Text>
      <View style={styles.accountOptions}>
        <TouchableOpacity 
          style={styles.accountOption}
          onPress={() => navigation.navigate('PaymentScreen', { fromBooking: false })}
        >
          <View style={styles.accountOptionLeft}>
            <Ionicons name="card-outline" size={20} color="#6B7280" />
            <Text style={styles.accountOptionText}>Payment Methods</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.accountOption}
          onPress={() => navigation.navigate('NotificationsScreen')}
        >
          <View style={styles.accountOptionLeft}>
            <Ionicons name="notifications-outline" size={20} color="#6B7280" />
            <Text style={styles.accountOptionText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.accountOption}
          onPress={() => navigation.navigate('PrivacyScreen')}
        >
          <View style={styles.accountOptionLeft}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#6B7280" />
            <Text style={styles.accountOptionText}>Privacy & Security</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.accountOption}
          onPress={() => navigation.navigate('HelpScreen')}
        >
          <View style={styles.accountOptionLeft}>
            <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
            <Text style={styles.accountOptionText}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.accountOption, styles.signOutOption]}
          onPress={handleSignOut}
        >
          <View style={styles.accountOptionLeft}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={[styles.accountOptionText, styles.signOutText]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3ad3db" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleChangeAvatar = async () => {
    const persist = async (uri: string) => {
      if (!user?.id) return;
      const { error } = await supabase
        .from('users')
        .update({ avatar_url: uri, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (!error) {
        setAvatarUri(uri);
        await refreshUser();
      }
    };
    try {
      Alert.alert('Profile Photo', 'Choose a source', [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
            if (!result.canceled && result.assets?.[0]?.uri) await persist(result.assets[0].uri);
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
            if (!result.canceled && result.assets?.[0]?.uri) await persist(result.assets[0].uri);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } catch {}
  };

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
        {renderProfileHeader()}
        {renderUserStats()}
        {renderQuickActions()}
        {renderUpcomingBookings()}
        {renderRecentActivity()}
        {renderAccountManagement()}
        
        {/* Bottom spacing for navigation */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Floating Navigation */}
      <FloatingNavigation navigation={navigation as any} currentScreen="Profile" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  safeHeader: {
    height: 0,
  },

  // Profile Header
  profileHeader: {
    marginBottom: 0,
    backgroundColor: '#FFFFFF',
  },
  profileGradient: {
    paddingTop: 12,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  profileHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#374151',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 6,
  },
  memberSince: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberSinceText: {
    fontSize: 12,
    color: '#6B7280',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Performance
  performanceSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
  },
  performanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
  },
  performanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  performanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  performanceNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  performanceDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 16,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },

  // Sections
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 20,
  },
  sectionLink: {
    fontSize: 14,
    color: '#3ad3db',
    fontWeight: '500',
  },

  // Quick Actions
  quickActionsGrid: {
    gap: 12,
  },
  quickActionCard: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionPrimary: {
    width: '100%',
    minHeight: 96,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionSecondary: {
    width: (width - 56) / 2,
    minHeight: 96,
  },
  quickActionContent: {
    padding: 14,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 8,
  },
  quickActionTextStack: {
    gap: 4,
  },
  favoriteToggle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 2,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  quickActionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
  },

  // Booking Cards
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: 'rgba(58, 211, 219, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  serviceTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  bookingDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  bookingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bookingPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  rebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  rebookText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3ad3db',
  },

  // Account Options
  accountOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  accountOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountOptionText: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  signOutOption: {
    borderBottomWidth: 0,
  },
  signOutText: {
    color: '#EF4444',
  },

  // Loading & Bottom Spacing
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default CustomerProfileScreen; 