import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import FloatingNavigation from '../../components/FloatingNavigation';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { USE_MOCK_DATA } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
};

type ProfileScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Profile'>;

interface ProfileScreenProps {
  navigation: ProfileScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'saved'>('overview');
  const animatedValues = useRef<{ [key: string]: Animated.Value }>({});
  const { signOut, authUser, refreshUser } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = (authUser?.user as any)?.avatar_url as string | undefined;
    if (url) setAvatarUrl(url);
  }, [authUser]);

  const handleCreateAdditionalAccount = () => {
    Alert.alert(
      'Create Additional Account',
      'Choose what type of additional account you want to create:',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Customer Account',
          onPress: () => {
            Alert.alert(
              'Customer Account Creation',
              'This feature will allow you to create an additional customer account while keeping your current account. You can switch between accounts anytime.',
              [{ text: 'Got it' }]
            );
          }
        },
        {
          text: 'Cleaner Account',
          onPress: () => {
            Alert.alert(
              'Cleaner Account Creation',
              'This feature will allow you to create an additional cleaner account while keeping your current account. You can switch between accounts anytime.',
              [{ text: 'Got it' }]
            );
          }
        }
      ]
    );
  };

  // Mock user data
  const user = {
    name: 'John Smith',
    email: 'john.smith@email.com',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    location: 'San Francisco, CA',
    phone: '+1 (555) 123-4567',
    memberSince: 'March 2023',
    totalBookings: 24,
    totalSpent: 1240,
    savedCleaners: 8,
  };

  const recentBookings = USE_MOCK_DATA ? [
    {
      id: '1',
      service: 'Kitchen Deep Clean',
      date: 'Dec 15, 2023',
      status: 'completed',
      price: 89,
      cleaner: 'Sarah Martinez',
      cleanerAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    {
      id: '2',
      service: 'Bathroom Deep Clean',
      date: 'Dec 12, 2023',
      status: 'completed',
      price: 75,
      cleaner: 'Mike Wilson',
      cleanerAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    {
      id: '3',
      service: 'Living Room Cleaning',
      date: 'Dec 10, 2023',
      status: 'completed',
      price: 95,
      cleaner: 'Lisa Chen',
      cleanerAvatar: 'https://randomuser.me/api/portraits/women/68.jpg',
    },
  ] : [];

  const savedCleaners = USE_MOCK_DATA ? [
    {
      id: '1',
      name: 'Sarah Martinez',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
      specialty: 'Kitchen Specialist',
      rating: 4.9,
      reviews: 420,
      hourlyRate: 89,
      available: true,
      topRated: true,
      mostBooked: false,
    },
    {
      id: '2',
      name: 'Mike Wilson',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
      specialty: 'Bathroom Expert',
      rating: 4.8,
      reviews: 312,
      hourlyRate: 75,
      available: false,
      topRated: false,
      mostBooked: true,
    },
    {
      id: '3',
      name: 'Lisa Chen',
      avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
      specialty: 'Carpet Specialist',
      rating: 4.7,
      reviews: 258,
      hourlyRate: 120,
      available: true,
      topRated: false,
      mostBooked: false,
    },
  ] : [];



  const handleCardPress = (id: string) => {
    if (!animatedValues.current[id]) {
      animatedValues.current[id] = new Animated.Value(1);
    }

    Animated.sequence([
      Animated.timing(animatedValues.current[id], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValues.current[id], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderTabButton = (tab: 'overview' | 'bookings' | 'saved', label: string) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
      activeOpacity={0.8}
      hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderBookingCard = (booking: any) => (
    <Animated.View
      key={booking.id}
      style={[
        styles.bookingCard,
        {
          transform: [{ scale: animatedValues.current[booking.id] || 1 }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.bookingCardTouchable}
        onPress={() => handleCardPress(booking.id)}
        activeOpacity={0.9}
      >
        <View style={styles.bookingHeader}>
          <Image source={{ uri: booking.cleanerAvatar }} style={styles.bookingCleanerAvatar} />
          <View style={styles.bookingInfo}>
            <Text style={styles.bookingService}>{booking.service}</Text>
            <Text style={styles.bookingCleaner}>{booking.cleaner}</Text>
            <Text style={styles.bookingDate}>{booking.date}</Text>
          </View>
          <View style={styles.bookingPrice}>
            <Text style={styles.bookingPriceText}>${booking.price}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>{booking.status}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSavedCleanerCard = (cleaner: any) => (
    <Animated.View
      key={cleaner.id}
      style={[
        styles.savedCleanerCard,
        {
          transform: [{ scale: animatedValues.current[cleaner.id] || 1 }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.savedCleanerCardTouchable}
        onPress={() => handleCardPress(cleaner.id)}
        activeOpacity={0.9}
      >
        <View style={styles.savedCleanerHeader}>
          <View style={styles.savedCleanerAvatarContainer}>
            <Image source={{ uri: cleaner.avatar }} style={styles.savedCleanerAvatar} />
            {cleaner.available && (
              <View style={styles.availableIndicator}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              </View>
            )}
          </View>
          <View style={styles.savedCleanerInfo}>
            <View style={styles.cleanerNameRow}>
              <Text style={styles.savedCleanerName}>{cleaner.name}</Text>
              {cleaner.topRated && (
                <View style={styles.topRatedBadge}>
                  <Ionicons name="star" size={10} color="#FFFFFF" />
                  <Text style={styles.badgeText}>Top Rated</Text>
                </View>
              )}
              {cleaner.mostBooked && (
                <View style={styles.mostBookedBadge}>
                  <Ionicons name="trending-up" size={10} color="#FFFFFF" />
                  <Text style={styles.badgeText}>Most Booked</Text>
                </View>
              )}
            </View>
            <Text style={styles.savedCleanerSpecialty}>{cleaner.specialty}</Text>
            <View style={styles.savedCleanerRating}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.savedCleanerRatingText}>
                {cleaner.rating} ({cleaner.reviews} reviews)
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={[styles.bookNowButton, !cleaner.available && styles.bookNowButtonDisabled]}
            disabled={!cleaner.available}
          >
            <LinearGradient
              colors={cleaner.available ? ['#00BFA6', '#0891B2'] : ['#E5E7EB', '#D1D5DB']}
              style={styles.bookNowGradient}
            >
              <Text style={[styles.bookNowText, !cleaner.available && styles.bookNowTextDisabled]}>
                {cleaner.available ? 'Book Now' : 'Unavailable'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={styles.savedCleanerFooter}>
          <Text style={styles.savedCleanerPrice}>${cleaner.hourlyRate}/hr</Text>
          <TouchableOpacity style={styles.removeButton}>
            <Ionicons name="heart-dislike" size={16} color="#FF4F5E" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Card */}
        <View style={styles.userCard}>
          <LinearGradient
            colors={['#FFFFFF', '#F8FFFE']}
            style={styles.userCardGradient}
          >
            <View style={styles.userInfo}>
              <View style={styles.avatarContainer}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={async () => {
                    const persist = async (uri: string) => {
                      setAvatarUrl(uri);
                      const userId = authUser?.user?.id as string | undefined;
                      if (userId) {
                        const { error } = await supabase
                          .from('users')
                          .update({ avatar_url: uri, updated_at: new Date().toISOString() })
                          .eq('id', userId);
                        if (error) {
                          console.error('Avatar update error:', error);
                          Alert.alert('Update failed', 'Could not save your profile photo.');
                        } else {
                          await refreshUser();
                        }
                      }
                    };

                    try {
                      Alert.alert(
                        'Profile Photo',
                        'Choose a source',
                        [
                          {
                            text: 'Take Photo',
                            onPress: async () => {
                              const { status } = await ImagePicker.requestCameraPermissionsAsync();
                              if (status !== 'granted') {
                                Alert.alert('Permission required', 'Allow camera access to take a photo.');
                                return;
                              }
                              const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
                              if (!result.canceled && result.assets?.[0]?.uri) {
                                await persist(result.assets[0].uri);
                              }
                            }
                          },
                          {
                            text: 'Choose from Library',
                            onPress: async () => {
                              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                              if (status !== 'granted') {
                                Alert.alert('Permission required', 'Allow photo access to set your profile image.');
                                return;
                              }
                              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images });
                              if (!result.canceled && result.assets?.[0]?.uri) {
                                await persist(result.assets[0].uri);
                              }
                            }
                          },
                          { text: 'Cancel', style: 'cancel' }
                        ]
                      );
                    } catch (e) {
                      console.error('Image pick error', e);
                    }
                  }}
                >
                  <Image source={{ uri: avatarUrl || user.avatar }} style={styles.profileAvatar} />
                  <View style={styles.editBadge}>
                    <Ionicons name="camera" size={14} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
                <View style={styles.avatarShadow} />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={styles.userLocation}>
                  <Ionicons name="location" size={16} color="#6B7280" />
                  <Text style={styles.locationText}>{user.location}</Text>
                </View>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Ionicons name="calendar" size={22} color="#3ad3db" />
                <Text style={styles.statNumber}>{user.totalBookings}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="card" size={22} color="#3ad3db" />
                <Text style={styles.statNumber}>${user.totalSpent}</Text>
                <Text style={styles.statLabel}>Spent</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="bookmark" size={22} color="#3ad3db" />
                <Text style={styles.statNumber}>{user.savedCleaners}</Text>
                <Text style={styles.statLabel}>Saved</Text>
              </View>
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity 
              style={styles.editProfileButton} 
              activeOpacity={0.8}
              onPress={() => Alert.alert('Edit Profile', 'Edit Profile screen coming soon! This will allow users to update their personal information, preferences, and account settings.')}
            >
              <LinearGradient
                colors={['#3ad3db', '#3ad3db']}
                style={styles.editProfileGradient}
              >
                <Ionicons name="pencil" size={18} color="#FFFFFF" />
                <Text style={styles.editProfileText}>Edit Profile</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {renderTabButton('overview', 'Overview')}
          {renderTabButton('bookings', 'Bookings')}
          {renderTabButton('saved', 'Saved')}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'overview' && (
            <View>
              {/* Member Since */}
              <View style={styles.section}>
                <View style={styles.memberCard}>
                  <Ionicons name="calendar" size={20} color="#00BFA6" />
                  <Text style={styles.memberText}>Member since {user.memberSince}</Text>
                </View>
              </View>

              {/* Account Settings */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account Settings</Text>
                <View style={styles.settingsList}>
                  <TouchableOpacity 
                    style={styles.settingItem} 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert(
                        'Personal Information',
                        'This feature allows you to update your personal details including name, email, phone, and address.',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="person-outline" size={20} color="#6B7280" />
                    <Text style={styles.settingText}>Personal Information</Text>
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.settingItem} 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert(
                        'Notification Settings',
                        'Configure your notification preferences for bookings, messages, and promotions.',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="notifications-outline" size={20} color="#6B7280" />
                    <Text style={styles.settingText}>Notifications</Text>
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.settingItem} 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert(
                        'Privacy & Security',
                        'Manage your privacy settings, account security, and data preferences.',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="shield-outline" size={20} color="#6B7280" />
                    <Text style={styles.settingText}>Privacy & Security</Text>
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.settingItem} 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert(
                        'Payment Methods',
                        'Add, remove, or edit your payment methods and billing information.',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="card-outline" size={20} color="#6B7280" />
                    <Text style={styles.settingText}>Payment Methods</Text>
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.settingItem} 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert(
                        'Help & Support',
                        'Get help with your account, report issues, or contact our support team.',
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
                    <Text style={styles.settingText}>Help & Support</Text>
                    <Ionicons name="chevron-forward" size={16} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.settingItem} 
                    activeOpacity={0.8}
                    onPress={handleCreateAdditionalAccount}
                  >
                    <Ionicons name="person-add-outline" size={20} color="#3ad3db" />
                    <Text style={[styles.settingText, { color: '#3ad3db' }]}>Create Additional Account</Text>
                    <Ionicons name="chevron-forward" size={16} color="#3ad3db" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.logoutItem} 
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert(
                        'Logout',
                        'Are you sure you want to logout?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Logout', style: 'destructive', onPress: signOut }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                    <Text style={styles.logoutText}>Logout</Text>
                    <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {activeTab === 'bookings' && (
            <View>
              {recentBookings.length > 0 ? (
                recentBookings.map(renderBookingCard)
              ) : (
                <EmptyState
                  {...EmptyStateConfigs.bookingHistory}
                  showFeatures={!USE_MOCK_DATA}
                  actions={USE_MOCK_DATA ? [] : [
                    {
                      label: 'Book Your First Service',
                      onPress: () => navigation.navigate('Discover'),
                      icon: 'add-circle',
                      primary: true,
                    },
                  ]}
                />
              )}
            </View>
          )}

          {activeTab === 'saved' && (
            <View>
              {savedCleaners.length > 0 ? (
                savedCleaners.map(renderSavedCleanerCard)
              ) : (
                <EmptyState
                  {...EmptyStateConfigs.savedCleaners}
                  showFeatures={!USE_MOCK_DATA}
                  actions={USE_MOCK_DATA ? [] : [
                    {
                      label: 'Discover Cleaners',
                      onPress: () => navigation.navigate('Discover'),
                      icon: 'compass',
                      primary: true,
                    },
                  ]}
                />
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Navigation */}
      <FloatingNavigation navigation={navigation} currentScreen="Profile" />
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
    paddingBottom: 140, // Extra padding to ensure content is not hidden behind nav bar
  },
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  userCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
    overflow: 'hidden',
  },
  userCardGradient: {
    padding: 20,
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 20,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    borderRadius: 48,
    backgroundColor: 'rgba(58, 211, 219, 0.15)',
    zIndex: -1,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#3ad3db',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'System',
  },
  userEmail: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
  },
  userLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  userPhone: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  phoneText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F0FDFA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3ad3db',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  editProfileButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  editProfileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  editProfileText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    position: 'relative',
    minHeight: 48, // Ensure minimum touch target
  },
  activeTab: {
    backgroundColor: 'rgba(58, 211, 219, 0.12)',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3ad3db',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 6,
    left: '50%',
    marginLeft: -15,
    width: 30,
    height: 3,
    backgroundColor: '#3ad3db',
    borderRadius: 2,
  },
  tabContent: {
    paddingHorizontal: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  memberText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 12,
    fontWeight: '500',
  },
  settingsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    marginLeft: 12,
    fontWeight: '500',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#FEF2F2',
    backgroundColor: '#FEF2F2',
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    color: '#EF4444',
    marginLeft: 12,
    fontWeight: '600',
  },
  bookingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  bookingCardTouchable: {
    padding: 20,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingCleanerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 16,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingService: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  bookingCleaner: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 4,
  },
  bookingDate: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  bookingPrice: {
    alignItems: 'flex-end',
  },
  bookingPriceText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 6,
  },
  statusBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#E6FFFA',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#3ad3db',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  savedCleanerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  savedCleanerCardTouchable: {
    padding: 20,
  },
  savedCleanerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  savedCleanerAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  savedCleanerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  availableIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
  },
  savedCleanerInfo: {
    flex: 1,
  },
  cleanerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  savedCleanerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 8,
  },
  topRatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  mostBookedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  savedCleanerSpecialty: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 6,
  },
  savedCleanerRating: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedCleanerRatingText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  bookNowButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bookNowButtonDisabled: {
    shadowOpacity: 0.05,
    elevation: 1,
  },
  bookNowGradient: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bookNowText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  bookNowTextDisabled: {
    color: '#9CA3AF',
  },
  savedCleanerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedCleanerPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F59E0B',
  },
  removeButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
  },
});

export default ProfileScreen; 