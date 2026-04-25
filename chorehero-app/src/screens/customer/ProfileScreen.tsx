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
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AppState } from 'react-native';
import { supabase } from '../../services/supabase';
import { uploadService } from '../../services/uploadService';
import { userStatsService } from '../../services/userStatsService';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { wp, hp } from '../../utils/responsive';
import { Row } from '../../components/ui';

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
    if (!user?.id) {
      loadMockData();
      setIsLoading(false);
      return;
    }
    // Show UI immediately with empty stats; load real data in background
    loadMockData();
    setIsLoading(false);
    loadProfileDataInBackground();
  }, [user?.id]);

  // Keep local avatar preview in sync with authenticated user
  useEffect(() => {
    if (user?.avatar_url) {
      setAvatarUri(user.avatar_url);
    }
  }, [user?.avatar_url]);

  /** Load profile data in background; does not block UI. */
  const loadProfileDataInBackground = async () => {
    if (!user?.id || user.id.startsWith('demo_')) return;
    try {
      const timeoutMs = 8000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile load timeout')), timeoutMs)
      );

      const [statsResult, upcomingResult, recentResult] = await Promise.race([
        Promise.all([
          userStatsService.getCustomerStats(user.id),
          userStatsService.getCustomerUpcomingBookings(user.id),
          userStatsService.getCustomerRecentActivity(user.id, 5),
        ]),
        timeoutPromise,
      ]);

      const realStats = statsResult.success ? statsResult.data! : null;
      const realUpcoming = upcomingResult.success ? upcomingResult.data! : null;
      const realRecent = recentResult.success ? recentResult.data! : null;

      if (realStats) setUserStats(realStats);
      if (realUpcoming) setUpcomingBookings(realUpcoming);
      if (realRecent) setRecentBookings(realRecent);
    } catch (e) {
      // Silent fail - UI already shows empty state
    }
  };

  const loadProfileData = async () => {
    try {
      setIsLoading(true);
      if (user?.id && !user.id.startsWith('demo_')) {
        try {
          const timeoutMs = 8000;
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Profile load timeout')), timeoutMs)
          );
          const [statsResult, upcomingResult, recentResult] = await Promise.race([
            Promise.all([
              userStatsService.getCustomerStats(user.id),
              userStatsService.getCustomerUpcomingBookings(user.id),
              userStatsService.getCustomerRecentActivity(user.id, 5),
            ]),
            timeoutPromise,
          ]);
          const realStats = statsResult.success ? statsResult.data! : { totalBookings: 0, completedBookings: 0, totalSpent: 0, favoriteCleaners: 0 };
          setUserStats(realStats);
          setUpcomingBookings(upcomingResult.success ? upcomingResult.data! : []);
          setRecentBookings(recentResult.success ? recentResult.data! : []);
        } catch (dbError) {
          loadMockData();
        }
      } else {
        loadMockData();
      }
    } catch (error) {
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
    // Mirrors the cleaner profile's "Edit profile" shortcut so customers can
    // jump straight to their profile editor without burying it inside Settings.
    const editProfileAction = {
      id: 'edit-profile',
      title: 'Edit profile',
      subtitle: 'Update name, contact, address & preferences',
      icon: 'create-outline',
      onPress: () => (navigation as any).navigate('EditProfileScreen'),
    };
    const secondaryActions = [
      editProfileAction,
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
              onPress: () =>
                Share.share({
                  message: 'Get $20 off your first cleaning on ChoreHero: https://chorehero.app',
                }).catch(() => {}),
            },
          ]
        : []),
      {
        id: 'favorites',
        title: 'My Favorites',
        subtitle: 'Saved cleaners',
        icon: 'heart',
        onPress: () => navigation.navigate('SavedServices'),
      },
    ];
    const allActions = [primaryAction, ...secondaryActions];
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsList}>
          {allActions.map((action) => (
            <View key={action.id} style={styles.quickActionRow}>
              <Row
                leadingIcon={action.icon as any}
                title={action.title}
                subtitle={action.subtitle}
                chevron
                onPress={action.onPress}
                trailing={
                  action.id === 'rebook' && hasLastPro ? (
                    <TouchableOpacity
                      onPress={toggleLastProFavorite}
                      accessibilityLabel="Toggle favorite cleaner"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={isLastProFavorite ? 'heart' : 'heart-outline'}
                        size={18}
                        color="#26B7C9"
                      />
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            </View>
          ))}
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
            <Ionicons name="repeat" size={16} color="#26B7C9" />
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
          <ActivityIndicator size="large" color="#26B7C9" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleChangeAvatar = async () => {
    const persist = async (uri: string) => {
      if (!user?.id) return;
      // Wait for app to be active after ImagePicker (avoids session loss on resume)
      if (AppState.currentState !== 'active') {
        await new Promise<void>((resolve) => {
          const sub = AppState.addEventListener('change', (s) => {
            if (s === 'active') {
              sub.remove();
              setTimeout(resolve, 400);
            }
          });
          if (AppState.currentState === 'active') {
            sub.remove();
            setTimeout(resolve, 400);
          }
        });
      } else {
        await new Promise((r) => setTimeout(r, 400));
      }
      try {
        let urlToSave = uri;
        if (uri.startsWith('file://')) {
          const upload = await uploadService.uploadFile(uri, 'image');
          if (!upload.success || !upload.url) {
            Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
            return;
          }
          urlToSave = upload.url;
        }
        const { error } = await supabase
          .from('users')
          .update({ avatar_url: urlToSave, updated_at: new Date().toISOString() })
          .eq('id', user.id);
        if (!error) {
          setAvatarUri(urlToSave);
          await refreshUser();
        }
      } catch (e) {
        console.warn('Avatar update failed:', e);
        Alert.alert('Error', 'Failed to update profile photo. Please try again.');
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
    paddingTop: hp('1.5%'),
    paddingBottom: 30,
    paddingHorizontal: wp('5%'),
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
    fontSize: wp('7%'),
    fontWeight: '700',
    color: '#374151',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: wp('6%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  profileEmail: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: hp('0.7%'),
  },
  memberSince: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1%'),
  },
  memberSinceText: {
    fontSize: wp('3%'),
    color: '#6B7280',
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: wp('5.5%'),
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Performance
  performanceSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: wp('5%'),
    marginTop: -15,
    borderRadius: wp('4%'),
    paddingVertical: hp('2%'),
    paddingHorizontal: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: hp('2.5%'),
  },
  performanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: hp('1.2%'),
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
    fontSize: wp('5%'),
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  performanceLabel: {
    fontSize: wp('3%'),
    color: '#6B7280',
    textAlign: 'center',
  },
  performanceDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    alignSelf: 'stretch',
    marginHorizontal: wp('2%'),
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: wp('5%'),
    marginTop: -15,
    borderRadius: wp('4%'),
    paddingVertical: hp('2.5%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: hp('2.5%'),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: wp('5%'),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: hp('0.5%'),
  },
  statLabel: {
    fontSize: wp('3%'),
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
    marginBottom: hp('3%'),
    paddingHorizontal: wp('5%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: hp('2%'),
  },
  sectionTitle: {
    fontSize: wp('4.5%'),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: hp('2.5%'),
  },
  sectionLink: {
    fontSize: wp('3.5%'),
    color: '#26B7C9',
    fontWeight: '500',
  },

  // Quick Actions — unified Row list
  quickActionsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  quickActionRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  favoriteToggle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: wp('3.5%'),
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
    fontSize: wp('3.5%'),
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
    borderRadius: wp('4%'),
    padding: 16,
    marginBottom: hp('1.5%'),
    shadowColor: 'rgba(38, 183, 201, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.5%'),
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
    marginBottom: 2,
  },
  serviceTitle: {
    fontSize: wp('3.5%'),
    color: '#6B7280',
    marginBottom: 2,
  },
  bookingDate: {
    fontSize: wp('3%'),
    color: '#9CA3AF',
  },
  statusBadge: {
    paddingHorizontal: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderRadius: wp('1.5%'),
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
    fontSize: wp('4%'),
    fontWeight: '700',
    color: '#1F2937',
  },
  rebookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.7%'),
    borderRadius: wp('2%'),
    gap: wp('1%'),
  },
  rebookText: {
    fontSize: wp('3%'),
    fontWeight: '600',
    color: '#26B7C9',
  },

  // Account Options
  accountOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('3%'),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accountOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2%'),
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  accountOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('3%'),
  },
  accountOptionText: {
    fontSize: wp('4%'),
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
    gap: wp('4%'),
  },
  loadingText: {
    fontSize: wp('4%'),
    color: '#6B7280',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default CustomerProfileScreen; 