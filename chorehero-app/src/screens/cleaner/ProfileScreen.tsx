import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  TextInput,
  Dimensions,
  Alert,
  ActivityIndicator,
  Switch,
  Platform,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../hooks/useAuth';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { MockDataToggle } from '../../utils/mockDataToggle';
import { COLORS } from '../../utils/constants';
import { supabase } from '../../services/supabase';
import { contentService } from '../../services/contentService';

const { width, height } = Dimensions.get('window');

type StackParamList = {
  CleanerProfile: undefined;
  CleanerDashboard: undefined;
  EarningsScreen: undefined;
  ScheduleScreen: undefined;
  HelpScreen: undefined;
  PaymentScreen: { fromBooking: boolean };
  NotificationsScreen: undefined;
  PrivacyScreen: undefined;
  VideoUpload: undefined;
  Earnings: undefined;
  JobsScreen: undefined;
};

type CleanerProfileProps = {
  navigation: StackNavigationProp<StackParamList, 'CleanerProfile'>;
};

interface CleanerProfileData {
  id: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  hourlyRate: number;
  avatar_url?: string;
  video_profile_url?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  background_check_date?: string;
  rating_average: number;
  total_jobs: number;
  specialties: string[];
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  service_radius: number;
  instant_booking: boolean;
}

const CleanerProfileScreen: React.FC<CleanerProfileProps> = ({ navigation }) => {
  const { user, signOut, setDemoUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'posts' | 'video' | 'verification' | 'settings'>('profile');
  const [userPosts, setUserPosts] = useState<any[]>([]);
  
  // Dashboard-related state
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [weeklyEarnings, setWeeklyEarnings] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [rating, setRating] = useState(0);

  const [isOnline, setIsOnline] = useState(true);
  
  // Initialize with empty data - will be populated by loadCleanerProfileData
  const [profileData, setProfileData] = useState<CleanerProfileData>({
    id: '',
    name: '',
    email: '',
    phone: '',
    bio: '',
    hourlyRate: 25,
    avatar_url: '',
    video_profile_url: '',
    verification_status: 'pending',
    background_check_date: '',
    rating_average: 0,
    total_jobs: 0,
    specialties: [],
    availability: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
    },
    service_radius: 15,
    instant_booking: false,
  });

  const videoRef = useRef<Video>(null);
  const availableSpecialties = [
    'Deep Cleaning', 'Standard Cleaning', 'Move-in/Move-out', 
    'Post-Construction', 'Eco-Friendly', 'Pet-Friendly', 
    'Office Cleaning', 'Window Cleaning', 'Carpet Cleaning'
  ];

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    setIsLoading(true);
    
    try {
      // Load both profile and dashboard data
      await Promise.all([
        loadCleanerProfileData(),
        loadDashboardData(),
        loadUserPosts()
      ]);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCleanerProfileData = async () => {
    // Check if user is authenticated and get real data or demo data
    const isRealUser = user?.id && !user.id.startsWith('demo_');
    
    if (isRealUser) {
      console.log('✅ REAL CLEANER detected - loading actual data for:', user.email, user.name, 'ID:', user.id);
      
      try {
        // Fetch user data from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userError) {
          console.error('Error fetching user data:', userError);
        }

        // Fetch cleaner profile data from database
        const { data: cleanerData, error: cleanerError } = await supabase
          .from('cleaner_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (cleanerError) {
          console.error('Error fetching cleaner profile:', cleanerError);
        }

        // Set real user data
        setProfileData(prev => ({
          ...prev,
          id: user.id,
          name: userData?.name || user.name || 'Professional Cleaner',
          email: userData?.email || user.email || '',
          phone: userData?.phone || '',
          bio: cleanerData?.bio || 'Welcome to ChoreHero! Complete your profile to start getting bookings.',
          hourlyRate: cleanerData?.hourly_rate || 25,
          verification_status: cleanerData?.verification_status || 'pending',
          rating_average: cleanerData?.rating_average || 0,
          total_jobs: cleanerData?.total_jobs || 0,
          specialties: cleanerData?.specialties || [],
          service_radius: cleanerData?.service_radius_km || 15,
          instant_booking: cleanerData?.is_available || false,
          avatar_url: userData?.avatar_url || cleanerData?.avatar_url || '',
          video_profile_url: cleanerData?.video_profile_url || '',
          background_check_date: cleanerData?.background_check_date || null,
          availability: {
            monday: true,
            tuesday: true,
            wednesday: true,
            thursday: true,
            friday: true,
            saturday: false,
            sunday: false,
          },
        }));

        console.log('Loaded real cleaner data:', {
          name: userData?.name,
          email: userData?.email,
          phone: userData?.phone,
          bio: cleanerData?.bio?.substring(0, 50) + '...',
          hourlyRate: cleanerData?.hourly_rate
        });

      } catch (error) {
        console.error('Error loading real cleaner data:', error);
        // Fallback to basic user data
        setProfileData(prev => ({
          ...prev,
          id: user.id,
          name: user.name || 'Professional Cleaner',
          email: user.email || '',
          phone: '',
          bio: 'Welcome to ChoreHero! Complete your profile to start getting bookings.',
          verification_status: 'pending',
          rating_average: 0,
          total_jobs: 0,
          avatar_url: '',
          video_profile_url: '',
        }));
      }
    } else {
      // Demo user - show mock data
      console.log('Demo cleaner - showing mock data');
      setProfileData(prev => ({
        ...prev,
        id: 'demo_cleaner_1',
        name: 'Sarah Martinez',
        email: 'sarah@example.com',
        phone: '+1 (555) 123-4567',
        bio: 'Professional cleaner with 5+ years experience. I specialize in deep cleaning and eco-friendly products.',
        hourlyRate: 35,
        avatar_url: 'https://randomuser.me/api/portraits/women/44.jpg',
        video_profile_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        verification_status: 'verified',
        background_check_date: '2024-01-15',
        rating_average: 4.8,
        total_jobs: 127,
        specialties: ['Deep Cleaning', 'Eco-Friendly', 'Pet-Friendly'],
        instant_booking: true,
      }));
    }
  };

  const loadDashboardData = async () => {
    try {
      // Check if we should use mock data
      const isRealUser = user?.id && !user.id.startsWith('demo_');
      
      if (isRealUser) {
        // Real user - start with zeros
        setTodayEarnings(0);
        setWeeklyEarnings(0);
        setCompletedJobs(0);
        setRating(0);
      } else {
        // Demo user - mock data
        setTodayEarnings(125.50);
        setWeeklyEarnings(387.25);
        setCompletedJobs(8);
        setRating(4.8);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadUserPosts = async () => {
    try {
      if (!user?.id) return;
      
      console.log('📋 Loading user posts for:', user.id);
      const response = await contentService.getFeed({
        filters: { user_id: user.id }
      });
      
      if (response.success && response.data && response.data.posts) {
        console.log(`✅ Loaded ${response.data.posts.length} user posts`);
        setUserPosts(response.data.posts);
      } else if (response.success && response.data && Array.isArray(response.data)) {
        console.log(`✅ Loaded ${response.data.length} user posts (direct array)`);
        setUserPosts(response.data);
      } else {
        console.log('No user posts found');
        setUserPosts([]);
      }
    } catch (error) {
      console.error('Error loading user posts:', error);
      setUserPosts([]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfileData();
    await loadUserPosts();
    setRefreshing(false);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileImageUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setProfileData(prev => ({
          ...prev,
          avatar_url: result.assets[0].uri,
        }));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const handleVideoUpload = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        videoMaxDuration: 60,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        
        // Simulate upload process
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        setProfileData(prev => ({
          ...prev,
          video_profile_url: result.assets[0].uri,
        }));
        
        Alert.alert('Success', 'Video uploaded successfully!');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              
              if (user?.id) {
                const result = await contentService.deletePost(user.id, postId);
                
                if (result.success) {
                  // Remove the post from local state
                  setUserPosts(prev => prev.filter(post => post.id !== postId));
                  Alert.alert('Success', 'Post deleted successfully');
                } else {
                  Alert.alert('Error', result.error || 'Failed to delete post');
                }
              }
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSwitchToCustomer = async () => {
    try {
      await setDemoUser('customer');
      Alert.alert('Account Switched', 'You are now in customer mode');
    } catch (error) {
      console.error('Error switching to customer:', error);
      Alert.alert('Error', 'Failed to switch account mode');
    }
  };

  const handleSelectProfileImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setIsUploading(true);
        
        try {
          const imageUri = result.assets[0].uri;
          
          // Update local state immediately for better UX
          setProfileData(prev => ({
            ...prev,
            avatar_url: imageUri,
          }));
          
          // Save to database
          if (user?.id) {
            const { error: updateError } = await supabase
              .from('users')
              .update({ 
                avatar_url: imageUri,
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
            
            if (updateError) {
              console.error('Error updating avatar in users table:', updateError);
              // Revert local state on error
              setProfileData(prev => ({
                ...prev,
                avatar_url: profileData.avatar_url,
              }));
              Alert.alert('Error', 'Failed to save profile picture to database');
              return;
            }
            
            // Also update cleaner_profiles table if it exists
            const { error: cleanerError } = await supabase
              .from('cleaner_profiles')
              .update({ 
                avatar_url: imageUri,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.id);
            
            if (cleanerError) {
              console.log('Note: Could not update cleaner_profiles avatar (may not exist yet):', cleanerError);
            }
            
            Alert.alert('Success', 'Profile picture updated and saved!');
          } else {
            Alert.alert('Error', 'User not authenticated');
          }
        } catch (dbError) {
          console.error('Database error:', dbError);
          Alert.alert('Error', 'Failed to save profile picture');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to upload profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleSpecialty = (specialty: string) => {
    setProfileData(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty],
    }));
  };

  const toggleAvailability = (day: keyof typeof profileData.availability) => {
    setProfileData(prev => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: !prev.availability[day],
      },
    }));
  };

  const getVerificationColor = () => {
    switch (profileData.verification_status) {
      case 'verified': return '#10B981';
      case 'pending': return '#F59E0B';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getVerificationText = () => {
    switch (profileData.verification_status) {
      case 'verified': return 'Verified';
      case 'pending': return 'Pending Review';
      case 'rejected': return 'Needs Update';
      default: return 'Not Verified';
    }
  };

  const renderProfileHeader = () => {
    const isRealUser = user?.id && !user.id.startsWith('demo_');
    
    return (
      <View style={styles.profileHeaderSection}>
        <View style={styles.headerRow}>
          <View style={styles.greetingSection}>
            <Text style={styles.greetingText}>Good morning,</Text>
            <Text style={styles.nameText}>{profileData.name}! 👋</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#6B7280' }]} />
              <Text style={styles.statusText}>{isOnline ? 'Ready to Work' : 'Offline'}</Text>
              <TouchableOpacity 
                style={[styles.onlineToggle, { backgroundColor: isOnline ? '#10B981' : '#6B7280' }]}
                onPress={() => setIsOnline(!isOnline)}
              >
                <Text style={styles.onlineToggleText}>{isOnline ? 'Online' : 'Offline'}</Text>
              </TouchableOpacity>
            </View>
            {isRealUser && (
              <View style={styles.accountStatus}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.accountStatusText}>Real Account</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={handleSelectProfileImage}
          >
            <Image 
              source={{ uri: profileData.avatar_url || 'https://via.placeholder.com/60x60' }} 
              style={styles.profileImage} 
            />
            <View style={styles.profileImageOverlay}>
              <Ionicons name="camera" size={18} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderDashboardStats = () => (
    <View style={styles.performanceSection}>
      <View style={styles.performanceHeader}>
        <Text style={styles.performanceTitle}>Today's Performance</Text>
        <TouchableOpacity onPress={() => navigation.navigate('EarningsScreen')}>
          <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
        </TouchableOpacity>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="cash" size={24} color="#10B981" />
          <Text style={styles.statValue}>${todayEarnings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="trending-up" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>${weeklyEarnings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={24} color="#3B82F6" />
          <Text style={styles.statValue}>{completedJobs}</Text>
          <Text style={styles.statLabel}>Jobs Done</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="star" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{rating.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>
    </View>
  );

  const calculateProfileCompletion = () => {
    const fields = [
      profileData.name,
      profileData.email,
      profileData.phone,
      profileData.bio,
      profileData.hourlyRate > 0,
      profileData.specialties.length > 0,
      profileData.avatar_url,
      profileData.video_profile_url
    ];
    const completed = fields.filter(field => field && field !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  const renderProfileCompletion = () => {
    const completion = calculateProfileCompletion();
    const isComplete = completion === 100;
    
    return (
      <View style={styles.profileCompletionCard}>
        <View style={styles.completionHeader}>
          <View style={styles.completionInfo}>
            <Text style={styles.completionTitle}>Profile Completion</Text>
            <Text style={styles.completionPercentage}>{completion}%</Text>
          </View>
          <View style={[styles.completionIcon, { backgroundColor: isComplete ? '#10B981' : '#F59E0B' }]}>
            <Ionicons 
              name={isComplete ? "checkmark-circle" : "alert-circle"} 
              size={24} 
              color="#FFFFFF" 
            />
          </View>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill, 
                { width: `${completion}%`, backgroundColor: isComplete ? '#10B981' : '#F59E0B' }
              ]} 
            />
          </View>
        </View>
        {!isComplete && (
          <Text style={styles.completionHint}>
            Complete your profile to get more bookings and increase your earnings!
          </Text>
        )}
      </View>
    );
  };

  const renderVerificationStatus = () => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'verified': return '#10B981';
        case 'pending': return '#F59E0B';
        case 'rejected': return '#EF4444';
        default: return '#6B7280';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'verified': return 'shield-checkmark';
        case 'pending': return 'time';
        case 'rejected': return 'close-circle';
        default: return 'help-circle';
      }
    };

    return (
      <View style={styles.verificationCard}>
        <View style={styles.verificationHeader}>
          <View style={[styles.verificationIcon, { backgroundColor: getStatusColor(profileData.verification_status) }]}>
            <Ionicons 
              name={getStatusIcon(profileData.verification_status)} 
              size={20} 
              color="#FFFFFF" 
            />
          </View>
          <View style={styles.verificationInfo}>
            <Text style={styles.verificationTitle}>Verification Status</Text>
            <Text style={[styles.verificationStatus, { color: getStatusColor(profileData.verification_status) }]}>
              {profileData.verification_status.charAt(0).toUpperCase() + profileData.verification_status.slice(1)}
            </Text>
          </View>
          <TouchableOpacity style={styles.verificationAction}>
            <Text style={styles.verificationActionText}>View Details</Text>
            <Ionicons name="chevron-forward" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.quickActionsSection}>
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('VideoUpload')}
        >
          <Ionicons name="videocam" size={24} color="#F59E0B" />
          <Text style={styles.quickActionText}>Create Post</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('JobsScreen')}
        >
          <Ionicons name="briefcase" size={24} color="#3B82F6" />
          <Text style={styles.quickActionText}>View Jobs</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('ScheduleScreen')}
        >
          <Ionicons name="calendar" size={24} color="#10B981" />
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.quickActionCard}
          onPress={() => navigation.navigate('Earnings')}
        >
          <Ionicons name="card" size={24} color="#8B5CF6" />
          <Text style={styles.quickActionText}>Earnings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderTabSelector = () => (
    <View style={styles.tabContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabScrollContent}
      >
        {[
          { id: 'profile', label: 'Profile', icon: 'person' },
          { id: 'posts', label: 'My Posts', icon: 'images' },
          { id: 'video', label: 'Video', icon: 'videocam' },
          { id: 'verification', label: 'Verification', icon: 'shield-checkmark' },
          { id: 'settings', label: 'Settings', icon: 'settings' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id as any)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Ionicons 
              name={tab.icon as any} 
              size={20} 
              color={activeTab === tab.id ? '#FFFFFF' : '#6B7280'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderProfileTab = () => (
    <View style={styles.tabContent}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <TouchableOpacity 
          style={styles.avatarContainer}
          onPress={handleProfileImageUpload}
        >
          <Image source={{ uri: profileData.avatar_url }} style={styles.avatar} />
          <View style={styles.avatarOverlay}>
            <Ionicons name="camera" size={24} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.profileStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData.rating_average.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profileData.total_jobs}</Text>
            <Text style={styles.statLabel}>Jobs</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>${profileData.hourlyRate}</Text>
            <Text style={styles.statLabel}>Per Hour</Text>
          </View>
        </View>
      </View>

      {/* Profile Form */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Basic Information</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.textInput}
            value={profileData.name}
            onChangeText={(text) => setProfileData(prev => ({ ...prev, name: text }))}
            placeholder="Enter your full name"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Bio</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={profileData.bio}
            onChangeText={(text) => setProfileData(prev => ({ ...prev, bio: text }))}
            placeholder="Tell customers about yourself..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Hourly Rate ($)</Text>
          <TextInput
            style={styles.textInput}
            value={profileData.hourlyRate.toString()}
            onChangeText={(text) => setProfileData(prev => ({ 
              ...prev, 
              hourlyRate: parseInt(text) || 0 
            }))}
            placeholder="35"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Service Radius (miles)</Text>
          <TextInput
            style={styles.textInput}
            value={profileData.service_radius.toString()}
            onChangeText={(text) => setProfileData(prev => ({ 
              ...prev, 
              service_radius: parseInt(text) || 0 
            }))}
            placeholder="15"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Specialties */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Specialties</Text>
        <View style={styles.specialtiesContainer}>
          {availableSpecialties.map((specialty) => (
            <TouchableOpacity
              key={specialty}
              style={[
                styles.specialtyChip,
                profileData.specialties.includes(specialty) && styles.selectedSpecialtyChip
              ]}
              onPress={() => toggleSpecialty(specialty)}
            >
              <Text style={[
                styles.specialtyText,
                profileData.specialties.includes(specialty) && styles.selectedSpecialtyText
              ]}>
                {specialty}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Availability */}
      <View style={styles.formSection}>
        <Text style={styles.sectionTitle}>Weekly Availability</Text>
        <View style={styles.availabilityContainer}>
          {Object.entries(profileData.availability).map(([day, available]) => (
            <View key={day} style={styles.availabilityRow}>
              <Text style={styles.dayLabel}>
                {day.charAt(0).toUpperCase() + day.slice(1)}
              </Text>
              <Switch
                value={available}
                onValueChange={() => toggleAvailability(day as any)}
                trackColor={{ false: '#E5E7EB', true: '#00BFA6' }}
                thumbColor={available ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderPostsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Posts</Text>
        <Text style={styles.sectionSubtitle}>
          {userPosts.length} {userPosts.length === 1 ? 'post' : 'posts'} shared
        </Text>
      </View>
      
      {userPosts.length === 0 ? (
        <View style={styles.emptyPostsContainer}>
          <Ionicons name="images-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyPostsTitle}>No posts yet</Text>
          <Text style={styles.emptyPostsSubtext}>
            Start sharing your cleaning transformations to attract more customers!
          </Text>
          <TouchableOpacity 
            style={styles.createPostButton}
            onPress={() => navigation.navigate('VideoUpload')}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createPostButtonText}>Create Post</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.postsGrid} showsVerticalScrollIndicator={false}>
          {userPosts.map((post, index) => (
            <View key={post.id} style={styles.postItem}>
              <View style={styles.postImageContainer}>
                {post.content_type === 'video' ? (
                  <View style={styles.postVideo}>
                    <Image 
                      source={{ uri: post.thumbnail_url || post.media_url }} 
                      style={styles.postImage}
                    />
                    <View style={styles.playIconOverlay}>
                      <Ionicons name="play" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                ) : (
                  <Image 
                    source={{ uri: post.media_url }} 
                    style={styles.postImage}
                  />
                )}
              </View>
              
              <View style={styles.postInfo}>
                <Text style={styles.postTitle} numberOfLines={2}>
                  {post.title}
                </Text>
                <Text style={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString()}
                </Text>
                
                <View style={styles.postStats}>
                  <View style={styles.postStat}>
                    <Ionicons name="heart" size={16} color="#F56565" />
                    <Text style={styles.postStatText}>{post.like_count || 0}</Text>
                  </View>
                  <View style={styles.postStat}>
                    <Ionicons name="chatbubble" size={16} color="#4299E1" />
                    <Text style={styles.postStatText}>{post.comment_count || 0}</Text>
                  </View>
                  <View style={styles.postStat}>
                    <Ionicons name="eye" size={16} color="#9CA3AF" />
                    <Text style={styles.postStatText}>{post.view_count || 0}</Text>
                  </View>
                </View>
                
                <TouchableOpacity 
                  style={styles.deletePostButton}
                  onPress={() => handleDeletePost(post.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderVideoTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Profile Video</Text>
      <Text style={styles.sectionSubtitle}>
        Share a 30-60 second video introducing yourself to potential customers
      </Text>

      {profileData.video_profile_url ? (
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: profileData.video_profile_url }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
          />
          
          <View style={styles.videoActions}>
            <TouchableOpacity 
              style={styles.videoActionButton}
              onPress={handleVideoUpload}
              disabled={isUploading}
            >
              <Ionicons name="refresh" size={20} color="#00BFA6" />
              <Text style={styles.videoActionText}>Replace Video</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.uploadVideoContainer}>
          <View style={styles.uploadVideoPlaceholder}>
            <Ionicons name="videocam-outline" size={64} color="#9CA3AF" />
            <Text style={styles.uploadVideoText}>No video uploaded yet</Text>
            <Text style={styles.uploadVideoSubtext}>
              Upload a video to increase booking chances by 300%
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.uploadVideoButton}
            onPress={handleVideoUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.uploadVideoButtonText}>Upload Video</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.videoTips}>
        <Text style={styles.tipsTitle}>Video Tips</Text>
        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Keep it under 60 seconds</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Introduce yourself and experience</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Show your cleaning supplies</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.tipText}>Speak clearly and smile</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderVerificationTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.oldVerificationHeader}>
        <View style={[styles.verificationBadge, { backgroundColor: getVerificationColor() }]}>
          <Ionicons name="shield-checkmark" size={24} color="#FFFFFF" />
        </View>
        <Text style={styles.oldVerificationStatus}>{getVerificationText()}</Text>
        <Text style={styles.verificationSubtext}>
          {profileData.verification_status === 'verified' 
            ? `Verified on ${new Date(profileData.background_check_date!).toLocaleDateString()}`
            : 'Complete verification to start accepting jobs'
          }
        </Text>
      </View>

      <View style={styles.verificationSteps}>
        <View style={styles.verificationStep}>
          <View style={[styles.stepIndicator, { backgroundColor: '#10B981' }]}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Identity Verification</Text>
            <Text style={styles.stepDescription}>Government ID verified</Text>
          </View>
        </View>

        <View style={styles.verificationStep}>
          <View style={[styles.stepIndicator, { backgroundColor: '#10B981' }]}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Background Check</Text>
            <Text style={styles.stepDescription}>Criminal background cleared</Text>
          </View>
        </View>

        <View style={styles.verificationStep}>
          <View style={[styles.stepIndicator, { backgroundColor: '#10B981' }]}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Insurance Coverage</Text>
            <Text style={styles.stepDescription}>Liability insurance active</Text>
          </View>
        </View>
      </View>

      {profileData.verification_status !== 'verified' && (
        <TouchableOpacity style={styles.verificationButton}>
          <Text style={styles.verificationButtonText}>Complete Verification</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderSettingsTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Booking Settings</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Instant Booking</Text>
            <Text style={styles.settingDescription}>
              Allow customers to book without approval
            </Text>
          </View>
          <Switch
            value={profileData.instant_booking}
            onValueChange={(value) => setProfileData(prev => ({ 
              ...prev, 
              instant_booking: value 
            }))}
            trackColor={{ false: '#E5E7EB', true: '#00BFA6' }}
            thumbColor={profileData.instant_booking ? '#FFFFFF' : '#F3F4F6'}
          />
        </View>
      </View>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => navigation.navigate('PaymentScreen', { fromBooking: false })}
        >
          <Ionicons name="card-outline" size={20} color="#6B7280" />
          <Text style={styles.settingButtonText}>Payment Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => navigation.navigate('NotificationsScreen')}
        >
          <Ionicons name="notifications-outline" size={20} color="#6B7280" />
          <Text style={styles.settingButtonText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => navigation.navigate('PrivacyScreen')}
        >
          <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
          <Text style={styles.settingButtonText}>Privacy & Security</Text>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => navigation.navigate('HelpScreen')}
        >
          <Ionicons name="help-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.settingButtonText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.settingsSection}>
        <TouchableOpacity 
          style={styles.settingButton}
          onPress={() => {
            Alert.alert(
              'Switch to Customer Account',
              'Switch to customer mode to book cleaning services and browse cleaners?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Switch to Customer', 
                  onPress: handleSwitchToCustomer
                }
              ]
            );
          }}
        >
          <Ionicons name="people-outline" size={20} color="#6B7280" />
          <Text style={styles.settingButtonText}>Switch to Customer</Text>
          <Ionicons name="chevron-forward" size={20} color="#6B7280" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.settingButton, styles.dangerButton]}
          onPress={() => {
            Alert.alert(
              'Sign Out',
              'Are you sure you want to sign out of your account?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut }
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={[styles.settingButtonText, styles.dangerText]}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentTab = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab();
      case 'posts': return renderPostsTab();
      case 'video': return renderVideoTab();
      case 'verification': return renderVerificationTab();
      case 'settings': return renderSettingsTab();
      default: return renderProfileTab();
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3ad3db" />
          <Text style={styles.loadingText}>Loading profile...</Text>
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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Profile Header */}
        {renderProfileHeader()}
        
        {/* Profile Completion */}
        {renderProfileCompletion()}
        
        {/* Verification Status */}
        {renderVerificationStatus()}
        
        {/* Dashboard Performance Section */}
        {renderDashboardStats()}
        
        {/* Quick Actions */}
        {renderQuickActions()}
        
        {/* Profile Management Tabs */}
        {renderTabSelector()}
        {renderCurrentTab()}
      </ScrollView>
      
      <CleanerFloatingNavigation 
        navigation={navigation as any}
        currentScreen="Profile"
        unreadCount={3}
      />
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
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F0FDFA',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3ad3db',
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    minHeight: 44, // Ensure adequate touch target
  },
  activeTab: {
    backgroundColor: '#3ad3db',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  tabContent: {
    padding: 20,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3ad3db',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  specialtiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialtyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  selectedSpecialtyChip: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  specialtyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  selectedSpecialtyText: {
    color: '#FFFFFF',
  },
  availabilityContainer: {
    gap: 12,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  videoContainer: {
    marginBottom: 24,
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#000',
  },
  videoActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  videoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00BFA6',
  },
  videoActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#00BFA6',
    marginLeft: 8,
  },
  uploadVideoContainer: {
    marginBottom: 24,
  },
  uploadVideoPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  uploadVideoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  uploadVideoSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  uploadVideoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00BFA6',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  uploadVideoButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  videoTips: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 16,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00BFA6',
    marginBottom: 12,
  },
  tipsList: {
    gap: 8,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    fontSize: 12,
    color: '#374151',
    marginLeft: 8,
  },
  oldVerificationHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 24,
  },
  verificationBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  oldVerificationStatus: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  verificationSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  verificationSteps: {
    gap: 16,
    marginBottom: 32,
  },
  verificationStep: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  verificationButton: {
    backgroundColor: '#00BFA6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  verificationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  settingsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 12,
  },
  dangerButton: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#EF4444',
  },
  // New dashboard styles
  profileHeaderSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingSection: {
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 12,
  },
  onlineToggle: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  onlineToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  accountStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  profileImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImageOverlay: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  performanceSection: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  performanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  performanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400E',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },


  quickActionsSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  quickActionCard: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 16,
  },
  quickActionText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  // Posts tab styles
  emptyPostsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyPostsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyPostsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createPostButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  postsGrid: {
    flex: 1,
  },
  postItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  postImageContainer: {
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  postVideo: {
    position: 'relative',
  },
  playIconOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postInfo: {
    padding: 16,
  },
  postTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  postDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 150,
  },
  postStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStatText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  deletePostButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  // Profile Completion Card Styles
  profileCompletionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  completionInfo: {
    flex: 1,
  },
  completionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  completionPercentage: {
    fontSize: 24,
    fontWeight: '700',
    color: '#059669',
  },
  completionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  completionHint: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Verification Card Styles
  verificationCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  verificationInfo: {
    flex: 1,
  },
  verificationTitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  verificationStatus: {
    fontSize: 16,
    fontWeight: '600',
  },
  verificationAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verificationActionText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 4,
  },
});

export default CleanerProfileScreen; 