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
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import { MockDataToggle } from '../../utils/mockDataToggle';
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
  const { user, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({
    totalBookings: 0,
    completedBookings: 0,
    totalSpent: 0,
    favoriteCleaners: 0,
  });
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);

  // Quick Actions Data
  const quickActions = [
    {
      id: 'book-now',
      title: 'Book Now',
      subtitle: 'Quick 60s booking',
      icon: 'add',
      color: ['#3ad3db', '#1ca7b7'] as const,
      onPress: () => navigation.navigate('BookingFlow', {}),
    },
    {
      id: 'browse-cleaners',
      title: 'Browse Cleaners',
      subtitle: 'View profiles & videos',
      icon: 'people',
      color: ['#3B82F6', '#1D4ED8'] as const,
      onPress: () => navigation.navigate('Content'),
    },
    {
      id: 'emergency',
      title: 'Emergency Clean',
      subtitle: 'ASAP booking',
      icon: 'flash',
      color: ['#F59E0B', '#F97316'] as const,
      onPress: () => navigation.navigate('BookingFlow', {}),
    },
    {
      id: 'favorites',
      title: 'My Favorites',
      subtitle: 'Saved cleaners',
      icon: 'heart',
      color: ['#EC4899', '#BE185D'] as const,
      onPress: () => Alert.alert('Favorites', 'Feature coming soon!'),
    },
  ];

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setIsLoading(true);

      // Check if user is authenticated and try to load real data
      if (user?.id && !user.id.startsWith('demo_')) {
        try {
          // Real authenticated user - load their actual data (empty for new accounts)
          console.log('✅ REAL USER detected - loading actual data for:', user.email, user.name, 'ID:', user.id);
          
          const realStats = {
            totalBookings: 0,
            completedBookings: 0,
            totalSpent: 0,
            favoriteCleaners: 0,
          };

          // Real bookings would be loaded from database here
          const realUpcoming: Booking[] = [];
          const realRecent: Booking[] = [];

                     // For real users, show actual data (empty states) instead of mock data
           const finalStats = realStats;
           const finalUpcoming = realUpcoming; 
           const finalRecent = realRecent;

          setUserStats(finalStats);
          setUpcomingBookings(finalUpcoming);
          setRecentBookings(finalRecent);
          
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
    // Fallback mock data loading
    const mockStats = MockDataToggle.getFeatureData(
      'CUSTOMER',
      'PROFILE_STATS',
      {
        totalBookings: 24,
        completedBookings: 22,
        totalSpent: 1847.50,
        favoriteCleaners: 8,
      },
      {
        totalBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
        favoriteCleaners: 0,
      }
    );

    const mockUpcoming = [
      {
        id: 'upcoming-1',
        status: 'upcoming' as const,
        cleaner: {
          id: 'cleaner-1',
          name: 'Sarah Martinez',
          avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
          rating: 4.9,
        },
        service: {
          type: 'kitchen',
          title: 'Kitchen Deep Clean',
          duration: 120,
        },
        schedule: {
          date: 'Tomorrow',
          time: '2:00 PM',
        },
        location: {
          address: '123 Main St, San Francisco',
        },
        payment: {
          total: 89.25,
        },
      }
    ];

    const mockRecent = [
      {
        id: 'recent-1',
        status: 'completed' as const,
        cleaner: {
          id: 'cleaner-2',
          name: 'Maria Lopez',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
          rating: 4.8,
        },
        service: {
          type: 'bathroom',
          title: 'Bathroom Deep Clean',
          duration: 90,
        },
        schedule: {
          date: 'Last Tuesday',
          time: '10:00 AM',
        },
        location: {
          address: '123 Main St, San Francisco',
        },
        payment: {
          total: 65.00,
        },
        review: {
          rating: 5,
          comment: 'Amazing work! Very thorough and professional.',
        },
      },
      {
        id: 'recent-2',
        status: 'completed' as const,
        cleaner: {
          id: 'cleaner-3',
          name: 'David Chen',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=150&q=80',
          rating: 4.7,
        },
        service: {
          type: 'living_room',
          title: 'Living Room Clean',
          duration: 75,
        },
        schedule: {
          date: 'Last Friday',
          time: '3:00 PM',
        },
        location: {
          address: '123 Main St, San Francisco',
        },
        payment: {
          total: 55.00,
        },
        review: {
          rating: 5,
          comment: 'Great attention to detail!',
        },
      }
    ];

    setUserStats(mockStats);
    setUpcomingBookings(mockUpcoming);
    setRecentBookings(mockRecent);
  };

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
        colors={['#3ad3db', '#1ca7b7']}
        style={styles.profileGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.profileHeaderContent}>
          <View style={styles.profileInfo}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileAvatarText}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'J'}
              </Text>
            </View>
            <View style={styles.profileDetails}>
                          <Text style={styles.profileName}>{user?.name || 'Guest User'}</Text>
            <Text style={styles.profileEmail}>{user?.email || 'guest@chorehero.com'}</Text>
              <View style={styles.memberSince}>
                <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.8)" />
                <Text style={styles.memberSinceText}>
                  {user?.id && !user.id.startsWith('demo_') 
                    ? `Real Account • ${new Date(user.created_at || '').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` 
                    : 'Demo Mode • Limited features'}
                </Text>
              </View>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => navigation.navigate('SettingsScreen')}
          >
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const renderUserStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats.totalBookings}</Text>
        <Text style={styles.statLabel}>Total Bookings</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>${userStats.totalSpent.toFixed(0)}</Text>
        <Text style={styles.statLabel}>Total Spent</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{userStats.favoriteCleaners}</Text>
        <Text style={styles.statLabel}>Favorites</Text>
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <View style={styles.section}>
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

  const renderBookingCard = (booking: Booking) => (
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
        <Image source={{ uri: booking.cleaner.avatar }} style={styles.cleanerAvatar} />
        <View style={styles.bookingInfo}>
          <Text style={styles.cleanerName}>{booking.cleaner.name}</Text>
          <Text style={styles.serviceTitle}>{booking.service.title}</Text>
          <Text style={styles.bookingDate}>{booking.schedule.date} at {booking.schedule.time}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
          <Text style={styles.statusText}>{booking.status}</Text>
        </View>
      </View>
      <View style={styles.bookingFooter}>
        <Text style={styles.bookingPrice}>${booking.payment.total.toFixed(2)}</Text>
        {booking.status === 'completed' && (
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
        <StatusBar barStyle="light-content" backgroundColor="#3ad3db" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3ad3db" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3ad3db" />
      
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
    backgroundColor: '#F9F9F9',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },

  // Profile Header
  profileHeader: {
    marginBottom: 0,
  },
  profileGradient: {
    paddingTop: 20,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 6,
  },
  memberSince: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  memberSinceText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: -15,
    borderRadius: 12,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: (width - 56) / 2,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 2,
    textAlign: 'center',
  },
  quickActionSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },

  // Booking Cards
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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