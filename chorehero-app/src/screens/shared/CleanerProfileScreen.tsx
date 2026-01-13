import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../utils/constants';
import type { StackNavigationProp } from '@react-navigation/stack';
import { routeToMessage, MessageParticipant } from '../../utils/messageRouting';

import { contentService } from '../../services/contentService';
import { presenceService } from '../../services/presenceService';
import { notificationService } from '../../services/notificationService';

import { useAuth } from '../../hooks/useAuth';
import { availabilityService } from '../../services/availabilityService';
import { supabase } from '../../services/supabase';

const { height } = Dimensions.get('window');

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
};

type CleanerProfileScreenNavigationProp = StackNavigationProp<TabParamList, 'CleanerProfile'>;

interface CleanerProfileScreenProps {
  navigation: CleanerProfileScreenNavigationProp;
  route: { params: { cleanerId: string } };
}

interface CleanerService {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  image: string;
}

interface Review {
  id: string;
  user: {
    name: string;
    avatar: string;
  };
  rating: number;
  comment: string;
  date: string;
}

interface CleanerVideo {
  id: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url?: string;
  view_count: number;
  like_count: number;
  created_at: string;
}

const CleanerProfileScreen: React.FC<CleanerProfileScreenProps> = ({ navigation, route }) => {
  const { cleanerId } = route.params || {};
  const { user } = useAuth();
  // Call hooks unconditionally and before any early returns to avoid hook-order errors
  const { width: winWidth } = useWindowDimensions();
  const isNarrow = winWidth < 360;
  const videoCardWidth = isNarrow ? winWidth - 40 : (winWidth - 40 - 16) / 2;
  const [activeTab, setActiveTab] = useState<'videos' | 'services' | 'reviews' | 'about'>('videos');
  const [showFullBio, setShowFullBio] = useState(false);
  const [cleaner, setCleaner] = useState<any | null>(null);
  const [services, setServices] = useState<CleanerService[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [videos, setVideos] = useState<CleanerVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CleanerVideo | null>(null);
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true); // Mock online status
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [hasRepeatClients, setHasRepeatClients] = useState(true); // Mock data
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [presence, setPresence] = useState<{ online: boolean; last_seen_at?: string } | null>(null);
  
  // Animation values
  const saveButtonScale = useRef(new Animated.Value(1)).current;
  // Subscribe to presence updates for this cleaner
  useEffect(() => {
    if (!cleanerId) return;
    let unsub: (() => void) | null = null;
    (async () => {
      const initial = await presenceService.getPresence(cleanerId);
      if (initial) setPresence({ online: !!initial.online, last_seen_at: initial.last_seen_at });
      unsub = presenceService.subscribe(cleanerId, (rec) => {
        if (rec) setPresence({ online: !!rec.online, last_seen_at: rec.last_seen_at });
      });
    })();
    return () => { if (unsub) unsub(); };
  }, [cleanerId]);

  // Load saved following state from storage
  useEffect(() => {
    const loadFollowing = async () => {
      try {
        const raw = await AsyncStorage.getItem('following_cleaners');
        const set: string[] = raw ? JSON.parse(raw) : [];
        if (cleanerId && Array.isArray(set)) setIsFollowing(set.includes(cleanerId));
      } catch {}
    };
    loadFollowing();
  }, [cleanerId]);

  const toggleFollow = async () => {
    try {
      const raw = await AsyncStorage.getItem('following_cleaners');
      const set: string[] = raw ? JSON.parse(raw) : [];
      let next: string[];
      const isNowFollowing = !set.includes(cleanerId);
      
      if (set.includes(cleanerId)) {
        next = set.filter(id => id !== cleanerId);
        setIsFollowing(false);
      } else {
        next = [...set, cleanerId];
        setIsFollowing(true);
      }
      await AsyncStorage.setItem('following_cleaners', JSON.stringify(next));
      
      // Send follow notification to cleaner (only when following, not unfollowing)
      if (isNowFollowing && user && cleanerId && user.id !== cleanerId) {
        try {
          await notificationService.sendFollowNotification(
            cleanerId,
            user.id,
            user.name || 'A customer',
            user.avatar_url
          );
          console.log('👋 Follow notification sent to cleaner:', cleanerId);
        } catch (error) {
          console.log('Could not send follow notification:', error);
        }
      }
    } catch {}
  };

  const loadCleanerAvailability = async (cleanerId: string) => {
    try {
      setLoadingAvailability(true);
      console.log('📅 Loading availability for cleaner:', cleanerId);

      // Skip DB availability when cleanerId is not a UUID (e.g., pexels/demo ids)
      if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanerId)) {
        setNextAvailable('This week');
        setLoadingAvailability(false);
        return;
      }

      // Get cleaner's availability schedule
      const availabilityResponse = await availabilityService.getCleanerAvailability(cleanerId);
      
      if (!availabilityResponse.success) {
        console.log('❌ Failed to load availability:', availabilityResponse.error);
        setNextAvailable('Schedule not available');
        setLoadingAvailability(false);
        return;
      }

      const schedule = availabilityResponse.data;
      
      // Find next available time slot
      const nextAvailableSlot = findNextAvailableSlot(schedule);
      setNextAvailable(nextAvailableSlot);
      
    } catch (error) {
      console.error('❌ Error loading cleaner availability:', error);
      setNextAvailable('Schedule not available');
    } finally {
      setLoadingAvailability(false);
    }
  };

  const findNextAvailableSlot = (schedule: any): string => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
    
    // Days of week array for formatting
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Check each day starting from today
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDay + dayOffset) % 7;
      const daySchedule = schedule[checkDay];
      
      if (!daySchedule || daySchedule.length === 0) continue;
      
      // For today, find slots after current time
      // For future days, find earliest slot
      for (const slot of daySchedule) {
        if (!slot.is_available) continue;
        
        const [startHour, startMinute] = slot.start_time.split(':').map(Number);
        const slotStartTime = startHour * 60 + startMinute;
        
        // If it's today, slot must be in the future
        if (dayOffset === 0 && slotStartTime <= currentTime + 60) { // 60 min buffer
          continue;
        }
        
        // Format the time
        const slotDate = new Date(now);
        slotDate.setDate(slotDate.getDate() + dayOffset);
        
        const timeString = formatTimeSlot(slot.start_time);
        
        if (dayOffset === 0) {
          return `Today, ${timeString}`;
        } else if (dayOffset === 1) {
          return `Tomorrow, ${timeString}`;
        } else {
          return `${daysOfWeek[checkDay]}, ${timeString}`;
        }
      }
    }
    
    return 'No availability this week';
  };

  const formatTimeSlot = (timeString: string): string => {
    const [hour, minute] = timeString.split(':').map(Number);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const loadCleanerVideos = async (cleanerId: string) => {
    try {
      setLoadingVideos(true);
      console.log('🎬 Loading videos for cleaner:', cleanerId);
      
      // For non-UUID demo/pexels ids, show sample placeholder videos
      if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(cleanerId)) {
        const sampleVideos: CleanerVideo[] = [
          {
            id: 'demo-vid-1',
            title: 'Cleaning Showcase',
            description: '',
            media_url: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=800',
            thumbnail_url: 'https://images.unsplash.com/photo-1581579188871-45ea61f2a0c8?w=800',
            view_count: 1200,
            like_count: 89,
            created_at: new Date().toISOString(),
          },
        ];
        setVideos(sampleVideos);
        return;
      }

      // Get videos by this specific cleaner from content service
      const response = await contentService.getFeed({
        filters: { 
          content_type: 'video',
          user_id: cleanerId // Filter by specific cleaner
        },
        sort_by: 'recent',
        limit: 20 // Show all their videos
      });

      if (response.success && response.data?.posts) {
        const cleanerVideos = response.data.posts.map((post: any) => ({
          id: post.id,
          title: post.title || 'Cleaning Video',
          description: post.description || '',
          media_url: post.media_url,
          thumbnail_url: post.thumbnail_url,
          view_count: post.view_count || 0,
          like_count: post.like_count || 0,
          created_at: post.created_at
        }));
        
        console.log(`✅ Loaded ${cleanerVideos.length} videos for cleaner`);
        setVideos(cleanerVideos);
      } else {
        console.log('📭 No videos found for this cleaner, showing sample videos');
        // Show sample videos as fallback
        const sampleVideos: CleanerVideo[] = [
          {
            id: '1',
            title: 'Kitchen Deep Clean Demo',
            media_url: '',
            thumbnail_url: '',
            view_count: 1200,
            like_count: 89,
            created_at: new Date().toISOString(),
          },
          {
            id: '2',
            title: 'Bathroom Sanitization',
            media_url: '',
            thumbnail_url: '',
            view_count: 850,
            like_count: 67,
            created_at: new Date().toISOString(),
          },
        ];
        setVideos(sampleVideos);
      }
    } catch (error) {
      console.error('❌ Error loading cleaner videos:', error);
      setVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    const fetchCleanerData = async () => {
      try {
        setLoading(true);
        if (!cleanerId) {
          console.error('❌ No cleanerId provided to CleanerProfileScreen');
          setError('No cleaner specified');
          setLoading(false);
          return;
        }
        const idToLoad = cleanerId;
        console.log('🔍 CleanerProfileScreen loading with cleanerId:', idToLoad);
        const isUuid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(idToLoad);
        
        // Load real cleaner data from database (only for UUIDs)
        console.log(`🔄 Loading cleaner profile for ID: ${idToLoad}`);

        let cleanerData: any = null; let cleanerError: any = null;
        let cleanerProfileData: any = null;
        
        if (isUuid) {
          // Fetch user data
          const result = await supabase
            .from('users')
            .select(`
              id,
              name,
              phone,
              email,
              avatar_url,
              role,
              is_active,
              created_at
            `)
            .eq('id', idToLoad)
            .eq('role', 'cleaner')
            .single();
          cleanerData = result.data;
          cleanerError = result.error;

          // Fetch cleaner profile data
          if (!cleanerError && cleanerData) {
            const { data: profileData } = await supabase
              .from('cleaner_profiles')
              .select('*')
              .eq('user_id', idToLoad)
              .single();
            cleanerProfileData = profileData;
            console.log('📋 Loaded cleaner profile:', cleanerProfileData);
          }
        }

        if (cleanerError || !cleanerData) {
          if (!isUuid) {
            // Non-UUID demo/pexels id path - use demo data
            console.log('📋 Using demo data for non-UUID:', idToLoad);
            const demoCleanerData = {
              id: idToLoad,
              name: 'Professional Cleaner',
              phone: '+1-555-0100',
              email: 'cleaner@chorehero.com',
              avatar_url: `https://ui-avatars.com/api/?name=Professional+Cleaner&size=120&background=0ea5e9&color=ffffff&bold=true`,
              role: 'cleaner' as const,
              is_active: true,
              profile: {
                video_profile_url: '',
                hourly_rate: 0,
                rating_average: 0,
                total_jobs: 0,
                bio: 'Professional cleaning specialist with years of experience.',
                specialties: ['Deep Cleaning', 'Professional Service'],
                verification_status: 'pending' as const,
                is_available: true,
                service_radius_km: 25,
              },
            };
            setCleaner(demoCleanerData);
          } else {
            console.error('❌ Error fetching cleaner data:', cleanerError);
            setCleaner(null);
          }
        } else {
          console.log('✅ Loaded real cleaner data:', cleanerData.name);
          // Use REAL profile data from database
          setCleaner({
            ...cleanerData,
            profile: {
              video_profile_url: cleanerProfileData?.video_profile_url || '',
              hourly_rate: cleanerProfileData?.hourly_rate || 0,
              rating_average: cleanerProfileData?.rating_average || 0,
              total_jobs: cleanerProfileData?.total_jobs || 0,
              bio: cleanerProfileData?.bio || 'Professional cleaning specialist',
              specialties: cleanerProfileData?.specialties || [],
              verification_status: cleanerProfileData?.verification_status || 'pending',
              is_available: cleanerProfileData?.is_available ?? true,
              service_radius_km: cleanerProfileData?.service_radius_km || 25,
              coverage_area: cleanerProfileData?.coverage_area || '',
              years_experience: cleanerProfileData?.years_experience || 0,
            },
          });
        }

        // Load cleaner's services (skip when not UUID)
        let services: any[] | null = null; let servicesError: any = null;
        if (isUuid) {
          const res = await supabase
            .from('cleaner_services')
            .select(`
              id,
              custom_price,
              is_available,
              category:service_categories(
                name,
                description,
                base_price,
                estimated_duration_minutes
              )
            `)
            .eq('cleaner_id', idToLoad)
            .eq('is_available', true);
          services = res.data; servicesError = res.error;
        }

        if (servicesError) {
          console.warn('⚠️ Error loading services:', servicesError);
          setServices([]);
        } else {
          setServices(services || []);
          console.log(`✅ Loaded ${services?.length || 0} services for cleaner`);
        }

        // Load cleaner's reviews
        const { data: reviews, error: reviewsError } = await supabase
          .from('reviews')
          .select(`
            id,
            rating,
            comment,
            created_at,
            customer:users!customer_id(
              name,
              avatar_url
            )
          `)
          .eq('cleaner_id', idToLoad)
          .order('created_at', { ascending: false })
          .limit(10);

        if (reviewsError) {
          console.warn('⚠️ Error loading reviews:', reviewsError);
          setReviews([]);
        } else {
          setReviews(reviews || []);
          console.log(`✅ Loaded ${reviews?.length || 0} reviews for cleaner`);
        }

        // Load videos and availability
        await loadCleanerVideos(idToLoad);
        await loadCleanerAvailability(idToLoad);

      } catch (error) {
        console.error('Error fetching cleaner data:', error);
        // Set empty data on error
        setCleaner(null);
        setServices([]);
        setReviews([]);
        setVideos([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCleanerData();
  }, [cleanerId]);

  // Animate save button on press
  const handleSavePress = () => {
    Animated.sequence([
      Animated.timing(saveButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(saveButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    setIsSaved(!isSaved);
  };



  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3ad3db" />
        <Text style={styles.loadingText}>Loading cleaner profile...</Text>
      </View>
    );
  }

  if (!cleaner) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#3ad3db" />
          </TouchableOpacity>
          <View style={{ width: 44 }} />
          <View style={styles.shareButton} />
        </View>

        <View style={styles.emptyStateContainer}>
          <LinearGradient
            colors={['#F9FAFB', '#F3F4F6']}
            style={styles.emptyStateGradient}
          >
            <View style={styles.emptyStateIconContainer}>
              <LinearGradient colors={['#3ad3db', '#2BC8D4']} style={styles.emptyStateIconGradient}>
                <Ionicons name="person-outline" size={64} color="#ffffff" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyStateTitle}>
              No cleaner data available
            </Text>
            <Text style={styles.emptyStateSubtitle}>
              Cleaner profiles will appear here when cleaners join your area and create their profiles.
            </Text>
            {true && (
              <View style={styles.emptyStateFeatures}>
                <View style={styles.featureItem}>
                  <Ionicons name="star" size={20} color="#3ad3db" />
                  <Text style={styles.featureText}>Verified cleaner profiles</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="shield-checkmark" size={20} color="#3ad3db" />
                  <Text style={styles.featureText}>Background checked</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="chatbubble" size={20} color="#3ad3db" />
                  <Text style={styles.featureText}>Direct messaging</Text>
                </View>
              </View>
            )}
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.exploreButtonText}>Go Back</Text>
              <Ionicons name="arrow-back" size={20} color="#3ad3db" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </SafeAreaView>
    );
  }

  const renderTabButton = (tab: 'videos' | 'services' | 'reviews' | 'about', label: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab)}
      activeOpacity={0.8}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
        {label}
      </Text>
      {activeTab === tab && <View style={styles.activeTabIndicator} />}
    </TouchableOpacity>
  );

  const renderServiceCard = (service: CleanerService) => (
    <View style={styles.serviceCard} key={service.id}>
      <View style={styles.serviceHeader}>
        <View style={styles.serviceImageContainer}>
          <Image 
            source={{ uri: service.image || 'https://via.placeholder.com/60x60/009688/FFFFFF?text=🧹' }} 
            style={styles.serviceImage}
          />
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceTitle}>{service?.title || service?.name || 'Service'}</Text>
          <Text style={styles.serviceDescription}>{service.description}</Text>
          <View style={styles.serviceMeta}>
            <View style={styles.serviceMetaItem}>
              <Ionicons name="time-outline" size={14} color="#3ad3db" />
              <Text style={styles.serviceMetaText}>{service.duration}</Text>
            </View>
            <View style={styles.serviceMetaItem}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.serviceMetaText}>4.9</Text>
            </View>
          </View>
        </View>
        <View style={styles.servicePriceContainer}>
          <Text style={styles.servicePrice}>${service.price}</Text>
          <TouchableOpacity 
            style={styles.bookNowButton}
            onPress={() => navigation.navigate('NewBookingFlow', {
              cleanerId: cleaner?.id,
              serviceType: service.category,
              serviceName: service.name,
              basePrice: service.price
            })}
          >
            <LinearGradient
              colors={['#3ad3db', '#2BC8D4']}
              style={styles.bookNowGradient}
            >
              <Text style={styles.bookNowText}>Book Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderReviewCard = (review: Review) => (
    <View style={styles.reviewCard} key={review.id}>
      <View style={styles.reviewHeader}>
        <Image source={{ uri: review.user.avatar }} style={styles.reviewerAvatar} />
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{review.user.name}</Text>
          <View style={styles.reviewRating}>
            {[...Array(5)].map((_, index) => (
              <Ionicons
                key={index}
                name={index < review.rating ? "star" : "star-outline"}
                size={14}
                color="#fbbf24"
              />
            ))}
          </View>
        </View>
        <Text style={styles.reviewDate}>{review.date}</Text>
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
    </View>
  );

  // dimensions computed at top to ensure stable hook order

  const renderVideoCard = (video: CleanerVideo) => (
    <TouchableOpacity 
      key={video.id} 
      style={[styles.videoCard, { width: videoCardWidth }]}
      onPress={() => {
        // Navigate to full-screen video feed with all cleaner's videos
        navigation.navigate('VideoFeed' as any, {
          source: 'cleaner',
          cleanerId: cleanerId,
          initialVideoId: video.id,
        });
      }}
    >
      <View style={styles.videoThumbnailContainer}>
        {video.thumbnail_url || video.media_url ? (
          <Image 
            source={{ uri: video.thumbnail_url || video.media_url }} 
            style={styles.videoThumbnail}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Ionicons name="videocam" size={32} color="#3AD3DB" />
          </View>
        )}
        
        {/* Gradient overlay for depth */}
        <View style={styles.videoGradientOverlay} />
        
        {/* Play icon overlay */}
        <View style={styles.videoPlayOverlay}>
          <View style={styles.videoPlayButton}>
            <Ionicons name="play" size={22} color="#FFFFFF" />
          </View>
        </View>
        
        {/* Video stats */}
        <View style={styles.videoStats}>
          <View style={styles.videoStat}>
            <Ionicons name="eye" size={12} color="#3AD3DB" />
            <Text style={styles.videoStatText}>{video.view_count}</Text>
          </View>
          <View style={styles.videoStat}>
            <Ionicons name="heart" size={12} color="#EF4444" />
            <Text style={styles.videoStatText}>{video.like_count}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.videoInfo}>
        <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.videoDate}>
          {new Date(video.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      

      {/* Main Header */}
      <View style={styles.headerCompact}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileSection}>
          <View style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <Image 
                  source={{ uri: cleaner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleaner.name || 'Cleaner')}&background=3ad3db&color=fff&size=160&font-size=0.4&format=png` }} 
                  style={styles.profileAvatar} 
                />
                {/* Online Status Ring */}
                <View style={[styles.onlineStatusRing, { backgroundColor: presence?.online ? COLORS.success : '#9CA3AF' }]} />
                {cleaner.profile.verification_status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={12} color="white" />
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.nameContainer}>
                  <Text style={styles.profileName}>{cleaner?.name || 'Cleaner'}</Text>
                </View>
                <Text style={styles.profileUsername}>@{(cleaner?.name || 'cleaner').toLowerCase().replace(' ', '')}</Text>
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.locationText}>
                    {cleaner.profile.coverage_area || 'Location not set'}
                  </Text>
                  {cleaner.profile.service_radius_km > 0 && (
                    <Text style={styles.distanceText}>
                      • {Math.round(cleaner.profile.service_radius_km * 0.621)} mi radius
                    </Text>
                  )}
                </View>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.ratingText}>
                    {cleaner.profile.rating_average > 0 
                      ? `${cleaner.profile.rating_average} (${cleaner.profile.total_jobs} reviews)`
                      : 'New cleaner'}
                  </Text>
                </View>
              </View>
            </View>
            
            {/* Bio Card */}
            <View style={styles.bioCard}>
              <Text style={styles.profileBio} numberOfLines={showFullBio ? undefined : 3}>
                {cleaner.profile.bio}
              </Text>
              {cleaner.profile.bio && cleaner.profile.bio.length > 100 && (
                <TouchableOpacity onPress={() => setShowFullBio(!showFullBio)} activeOpacity={0.7}>
                  <Text style={styles.readMoreText}>{showFullBio ? 'Show less' : 'Read more'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Trust Badges */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trustBadges}>
              <View style={styles.trustBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#059669" />
                <Text style={styles.trustBadgeText}>Verified by ChoreHero</Text>
              </View>
              <View style={styles.trustBadge}>
                <Ionicons name="trophy" size={14} color="#fbbf24" />
                <Text style={styles.trustBadgeText}>Top Rated in 2024</Text>
              </View>
              {hasRepeatClients && (
                <View style={styles.trustBadge}>
                  <Ionicons name="people" size={14} color="#8B5CF6" />
                  <Text style={styles.trustBadgeText}>100+ repeat clients</Text>
                </View>
              )}
            </ScrollView>

            {/* Stats Row (collapsible) */}
            <TouchableOpacity 
              style={styles.statsRow}
              activeOpacity={0.9}
              onPress={() => setStatsExpanded(!statsExpanded)}
            >
              {statsExpanded ? (
                <View style={styles.statsExpandedRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{cleaner.profile.total_jobs}</Text>
                    <Text style={styles.statLabel}>Bookings</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={16} color="#3ad3db" />
                    <Text style={styles.statValue}>&lt; 1 hour</Text>
                    <Text style={styles.statLabel}>Avg Response</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {cleaner.profile.hourly_rate > 0 ? `$${cleaner.profile.hourly_rate}/hr` : 'Contact'}
                    </Text>
                    <Text style={styles.statLabel}>Rate</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.statsCollapsedRow}>
                  <View style={styles.statCollapsedItem}>
                    <Ionicons name="briefcase-outline" size={16} color="#3ad3db" />
                    <Text style={styles.statCollapsedText}>{cleaner.profile.total_jobs} bookings</Text>
                  </View>
                  <View style={styles.statCollapsedItem}>
                    <Ionicons name="time-outline" size={16} color="#3ad3db" />
                    <Text style={styles.statCollapsedText}>&lt; 1 hour</Text>
                  </View>
                  <View style={styles.statCollapsedItem}>
                    <Ionicons name="pricetag-outline" size={16} color="#3ad3db" />
                    <Text style={styles.statCollapsedText}>
                      {cleaner.profile.hourly_rate > 0 ? `$${cleaner.profile.hourly_rate}/hr` : 'Contact'}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Availability */}
            <View style={styles.availabilityBubble}>
              <Ionicons name="calendar-outline" size={16} color="#3ad3db" />
              {loadingAvailability ? (
                <Text style={styles.availabilityText}>Loading availability…</Text>
              ) : (
                <Text style={styles.availabilityText}>
                  Next available: {nextAvailable || 'Schedule not available'}
                </Text>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.primaryActionButton}
                onPress={() => {
                  navigation.navigate('NewBookingFlow', {
                    cleanerId: cleaner?.id,
                    serviceName: 'Cleaning Service'
                  });
                }}
              >
                <LinearGradient
                  colors={['#3AD3DB', '#2BC8D0']}
                  style={styles.primaryActionGradient}
                >
                  <Ionicons name="calendar" size={20} color="white" />
                  <Text style={styles.primaryActionText}>Book Service</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <View style={styles.secondaryActions}>
                <TouchableOpacity 
                  style={styles.secondaryActionButton}
                  onPress={async () => {
                    // Check if user is authenticated
                    if (!user) {
                      Alert.alert(
                        'Sign In Required',
                        'Please sign in to message cleaners.',
                        [{ text: 'OK', style: 'default' }]
                      );
                      return;
                    }

                    // Check if user is trying to message themselves
                    if (user.id === cleaner.id) {
                      Alert.alert(
                        'Cannot Message Yourself',
                        'You cannot send messages to your own profile.',
                        [{ text: 'OK', style: 'default' }]
                      );
                      return;
                    }

                    const participant: MessageParticipant = {
                      id: cleaner.id,
                      name: cleaner.name,
                      avatar: cleaner.avatar_url || '',
                      role: 'cleaner',
                    };
                    
                    await routeToMessage({
                      participant,
                      navigation,
                      currentUserId: user.id,
                    });
                  }}
                >
                  <Ionicons name="chatbubble" size={20} color="#3ad3db" />
                  <Text style={styles.secondaryActionText}>Message</Text>
                </TouchableOpacity>
                
                <Animated.View style={{ transform: [{ scale: saveButtonScale }] }}>
                  <TouchableOpacity 
                    style={[styles.secondaryActionButton, isSaved && styles.savedActionButton]}
                    onPress={handleSavePress}
                  >
                    <Ionicons 
                      name={isSaved ? "bookmark" : "bookmark-outline"} 
                      size={20} 
                      color={isSaved ? "white" : "#3ad3db"} 
                    />
                    <Text style={[styles.secondaryActionText, isSaved && styles.savedActionText]}>
                      {isSaved ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  style={[styles.followSmallButton, isFollowing && styles.followSmallButtonActive]}
                  onPress={toggleFollow}
                >
                  <Ionicons name={isFollowing ? 'checkmark' : 'add'} size={18} color={isFollowing ? 'white' : '#3ad3db'} />
                  <Text style={[styles.followSmallText, isFollowing && styles.followSmallTextActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Sticky Tabs */}
        <View style={styles.tabsContainer}>
          {renderTabButton('videos', 'Videos')}
          {renderTabButton('services', 'Services')}
          {renderTabButton('reviews', 'Reviews')}
          {renderTabButton('about', 'About')}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'videos' && (
            <View>
              {loadingVideos ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#3ad3db" />
                  <Text style={styles.loadingText}>Loading videos...</Text>
                </View>
              ) : videos.length > 0 ? (
                <View style={styles.videosGrid}>
                  {videos.map(renderVideoCard)}
                </View>
              ) : (
                <View style={styles.emptyVideoState}>
                  <Ionicons name="videocam-outline" size={48} color="#C7C7CC" />
                  <Text style={styles.emptyVideoTitle}>No Videos Yet</Text>
                  <Text style={styles.emptyVideoSubtitle}>
                    This cleaner hasn't shared any videos of their work yet.
                  </Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'services' && (
            <View>
              {services.map(renderServiceCard)}
            </View>
          )}

          {activeTab === 'reviews' && (
            <View>
              {reviews.slice(0, 2).map(renderReviewCard)}
              {reviews.length > 2 && (
                <TouchableOpacity style={styles.viewAllReviewsButton}>
                  <Text style={styles.viewAllReviewsText}>View All {reviews.length} Reviews</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {activeTab === 'about' && (
            <View>
              <View style={styles.aboutCard}>
                <Text style={styles.aboutTitle}>Specialties</Text>
                <View style={styles.specialtiesList}>
                  {cleaner.profile.specialties.map((specialty: string, index: number) => (
                    <View key={index} style={styles.specialtyTag}>
                      <Text style={styles.specialtyText}>{specialty}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.aboutTitle}>Languages</Text>
                <View style={styles.languagesList}>
                  {['English', 'Spanish'].map((language: string, index: number) => (
                    <View key={index} style={styles.languageTag}>
                      <Text style={styles.languageText}>{language}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.aboutTitle}>Member Since</Text>
                <Text style={styles.memberSinceText}>March 2023</Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Video Player Modal */}
      <Modal
        visible={videoModalVisible}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setVideoModalVisible(false)}
      >
        <View style={styles.videoModalContainer}>
          <StatusBar barStyle="light-content" />
          
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.videoModalClose}
            onPress={() => setVideoModalVisible(false)}
          >
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          
          {/* Video Player */}
          {selectedVideo && (
            <Video
              source={{ uri: selectedVideo.media_url }}
              style={styles.videoModalPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
            />
          )}
          
          {/* Video Info */}
          <View style={styles.videoModalInfo}>
            <Text style={styles.videoModalTitle}>{selectedVideo?.title}</Text>
            <Text style={styles.videoModalDescription}>{selectedVideo?.description}</Text>
            <View style={styles.videoModalStats}>
              <View style={styles.videoModalStat}>
                <Ionicons name="eye" size={16} color="#FFFFFF" />
                <Text style={styles.videoModalStatText}>{selectedVideo?.view_count} views</Text>
              </View>
              <View style={styles.videoModalStat}>
                <Ionicons name="heart" size={16} color="#EF4444" />
                <Text style={styles.videoModalStatText}>{selectedVideo?.like_count} likes</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Main Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 0,
  },
  headerCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 211, 219, 0.2)',
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  profileAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: '#3ad3db',
  },
  onlineStatusRing: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'white',
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#3ad3db',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginRight: 8,
    letterSpacing: -0.5,
  },
  profileUsername: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 10,
    fontWeight: '500',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  locationText: {
    fontSize: 15,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: '500',
  },
  distanceText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 4,
    fontWeight: '400',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    fontSize: 15,
    color: '#64748B',
    marginLeft: 4,
    fontWeight: '500',
  },
  bioCard: {
    backgroundColor: '#F8FFFE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 211, 219, 0.15)',
  },
  profileBio: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 24,
    fontWeight: '400',
  },
  readMoreText: {
    fontSize: 13,
    color: '#3ad3db',
    fontWeight: '700',
    marginTop: 8,
  },
  trustBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 211, 219, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  trustBadgeText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(58, 211, 219, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  statsCollapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  statCollapsedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statCollapsedText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  statsExpandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  statItem: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3ad3db',
    marginLeft: 4,
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF7CD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE047',
    marginBottom: 24,
  },
  availabilityBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(58, 211, 219, 0.25)',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  availabilityText: {
    fontSize: 14,
    color: '#3AD3DB',
    fontWeight: '600',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  primaryActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  primaryActionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  savedActionButton: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  secondaryActionText: {
    color: '#3ad3db',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  savedActionText: {
    color: 'white',
  },
  followSmallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: 'rgba(58, 211, 219, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  followSmallButtonActive: {
    backgroundColor: '#3ad3db',
    borderColor: '#3ad3db',
  },
  followSmallText: {
    color: '#3ad3db',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  followSmallTextActive: {
    color: 'white',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.15)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
    minHeight: 44,
    borderRadius: 12,
  },
  activeTabButton: {
    backgroundColor: 'rgba(58, 211, 219, 0.12)',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTabButtonText: {
    color: '#3AD3DB',
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 4,
    left: '25%',
    right: '25%',
    height: 3,
    backgroundColor: '#3AD3DB',
    borderRadius: 2,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.12)',
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceImageContainer: {
    marginRight: 12,
  },
  serviceImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
  },
  serviceInfo: {
    flex: 1,
    marginRight: 12,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  serviceMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  serviceMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceMetaText: {
    fontSize: 12,
    color: '#3ad3db',
    marginLeft: 4,
  },
  servicePriceContainer: {
    alignItems: 'flex-end',
  },
  servicePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3ad3db', // Teal for customer-facing view
    marginBottom: 8,
  },
  bookNowButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  bookNowGradient: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  bookNowText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.08)',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  reviewRating: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  reviewComment: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  viewAllReviewsButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  viewAllReviewsText: {
    fontSize: 14,
    color: '#3ad3db',
    fontWeight: '600',
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(58, 211, 219, 0.15)',
  },
  aboutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 16,
  },
  specialtiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  specialtyTag: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  specialtyText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  languagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  languageTag: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  languageText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '500',
  },
  memberSinceText: {
    fontSize: 14,
    color: '#6B7280',
  },
  bottomSpacing: {
    height: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    color: '#1F2937',
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: {
    color: '#1F2937',
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
  },
  backButtonText: {
    color: '#3ad3db',
    fontSize: 16,
    fontWeight: '600',
  },

  // Empty State Styles
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIconContainer: {
    marginBottom: 30,
  },
  emptyStateIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  emptyStateTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  emptyStateFeatures: {
    alignItems: 'flex-start',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '600',
    marginLeft: 12,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3ad3db',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  
  // Video styles - Enhanced Depth Theme
  videosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 24,
  },
  videoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(58, 211, 219, 0.25)',
  },
  videoThumbnailContainer: {
    position: 'relative',
    height: 150,
    backgroundColor: '#F0FDFA',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'linear-gradient(180deg, #E8F7F8 0%, #D1F0F2 100%)',
  },
  videoGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'transparent',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3AD3DB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3AD3DB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  videoStats: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  videoStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  videoStatText: {
    color: '#1F2937',
    fontSize: 11,
    fontWeight: '700',
  },
  videoInfo: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(58, 211, 219, 0.1)',
  },
  videoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 20,
  },
  videoDate: {
    fontSize: 12,
    color: '#3AD3DB',
    fontWeight: '600',
  },
  emptyVideoState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyVideoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyVideoSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },

  exploreButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginRight: 8,
  },
  
  // Video Modal Styles
  videoModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalClose: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  videoModalPlayer: {
    width: '100%',
    height: '60%',
  },
  videoModalInfo: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    padding: 20,
  },
  videoModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  videoModalDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: 12,
  },
  videoModalStats: {
    flexDirection: 'row',
    gap: 20,
  },
  videoModalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoModalStatText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});

export default CleanerProfileScreen; 