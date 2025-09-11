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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { StackNavigationProp } from '@react-navigation/stack';
import { routeToMessage, MessageParticipant } from '../../utils/messageRouting';

import { contentService } from '../../services/contentService';

import { useAuth } from '../../hooks/useAuth';
import { availabilityService } from '../../services/availabilityService';
import { supabase } from '../../services/supabase';

const { width, height } = Dimensions.get('window');

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
  const [activeTab, setActiveTab] = useState<'videos' | 'services' | 'reviews' | 'about'>('videos');
  const [showFullBio, setShowFullBio] = useState(false);
  const [cleaner, setCleaner] = useState<any | null>(null);
  const [services, setServices] = useState<CleanerService[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [videos, setVideos] = useState<CleanerVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(true); // Mock online status
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [hasRepeatClients, setHasRepeatClients] = useState(true); // Mock data
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  
  // Animation values
  const saveButtonScale = useRef(new Animated.Value(1)).current;

  const loadCleanerAvailability = async (cleanerId: string) => {
    try {
      setLoadingAvailability(true);
      console.log('📅 Loading availability for cleaner:', cleanerId);

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
        const idToLoad = cleanerId || 'demo_cleaner_1';
        console.log('🔍 CleanerProfileScreen loading with cleanerId:', idToLoad);
        
        // Load real cleaner data from database
        console.log(`🔄 Loading cleaner profile for ID: ${idToLoad}`);

        // Fetch cleaner data from Supabase
        const { data: cleanerData, error: cleanerError } = await supabase
          .from('users')
          .select(`
            id,
            name,
            phone,
            email,
            avatar_url,
            role,
            is_active,
            created_at,
            profile:user_profiles(
              bio,
              hourly_rate,
              rating_average,
              total_jobs,
              specialties,
              verification_status,
              is_available,
              service_radius_km,
              video_profile_url
            )
          `)
          .eq('id', idToLoad)
          .eq('role', 'cleaner')
          .single();

        if (cleanerError) {
          console.error('❌ Error fetching cleaner data:', cleanerError);
          // Fallback to demo cleaner if real data not found
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
              hourly_rate: 85,
              rating_average: 4.8,
              total_jobs: 120,
              bio: 'Professional cleaning specialist with years of experience. Dedicated to providing excellent service.',
              specialties: ['Deep Cleaning', 'Professional Service', 'Reliable'],
              verification_status: 'verified' as const,
              is_available: true,
              service_radius_km: 25,
            },
          };
          setCleaner(demoCleanerData);
        } else {
          // Use real cleaner data
          console.log('✅ Loaded real cleaner data:', cleanerData.name);
          setCleaner(cleanerData);
        }

        // Load cleaner's services
        const { data: services, error: servicesError } = await supabase
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

        // Load videos from content service
        await loadCleanerVideos(idToLoad);
        
        // Load cleaner's availability schedule
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
          <Text style={styles.serviceTitle}>{service.title}</Text>
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
            onPress={() => navigation.navigate('SimpleBookingFlow', {
              cleanerId: cleaner?.id,
              serviceType: service.category
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

  const renderVideoCard = (video: CleanerVideo) => (
    <TouchableOpacity 
      key={video.id} 
      style={styles.videoCard}
      onPress={() => {
        // Navigate back to main feed focused on this video
        navigation.navigate('Home');
      }}
    >
      <View style={styles.videoThumbnailContainer}>
        <Image 
          source={{ uri: video.thumbnail_url || video.media_url }} 
          style={styles.videoThumbnail}
        />
        
        {/* Play icon overlay */}
        <View style={styles.videoPlayOverlay}>
          <View style={styles.videoPlayButton}>
            <Ionicons name="play" size={20} color="#FFFFFF" />
          </View>
        </View>
        
        {/* Video stats */}
        <View style={styles.videoStats}>
          <View style={styles.videoStat}>
            <Ionicons name="eye" size={12} color="#FFFFFF" />
            <Text style={styles.videoStatText}>{video.view_count}</Text>
          </View>
          <View style={styles.videoStat}>
            <Ionicons name="heart" size={12} color="#FFFFFF" />
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
          <Ionicons name="arrow-back" size={24} color="#3ad3db" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={24} color="#3ad3db" />
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
                <View style={[styles.onlineStatusRing, { backgroundColor: isOnline ? '#10B981' : '#9CA3AF' }]} />
                {cleaner.profile.verification_status === 'verified' && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark" size={12} color="white" />
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                <View style={styles.nameContainer}>
                  <Text style={styles.profileName}>{cleaner.name}</Text>
                </View>
                <Text style={styles.profileUsername}>@{cleaner.name.toLowerCase().replace(' ', '')}</Text>
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={14} color="#3ad3db" />
                  <Text style={styles.locationText}>San Francisco, CA</Text>
                  <Text style={styles.distanceText}>• 3.2 miles away</Text>
                </View>
                <View style={styles.ratingContainer}>
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.ratingText}>
                    {cleaner.profile.rating_average} ({cleaner.profile.total_jobs} reviews)
                  </Text>
                </View>
              </View>
            </View>
            
            <Text style={styles.profileBio} numberOfLines={showFullBio ? undefined : 2}>{cleaner.profile.bio}</Text>
            <TouchableOpacity onPress={() => setShowFullBio(!showFullBio)} activeOpacity={0.7}>
              <Text style={styles.readMoreText}>{showFullBio ? 'Show less' : 'Read more'}</Text>
            </TouchableOpacity>

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
                    <Text style={styles.statValue}>${cleaner.profile.hourly_rate}/hr</Text>
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
                    <Text style={styles.statCollapsedText}>${cleaner.profile.hourly_rate}/hr</Text>
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
                  // Prefer DynamicBooking if template exists; the screen will fallback if not
                  navigation.navigate('DynamicBooking', {
                    cleanerId: cleaner?.id
                  });
                }}
              >
                <LinearGradient
                  colors={['#3ad3db', '#2BC8D4']}
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
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
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
  profileBio: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
    marginBottom: 8,
    fontWeight: '400',
  },
  readMoreText: {
    fontSize: 13,
    color: '#3ad3db',
    fontWeight: '600',
    marginBottom: 16,
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
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(58, 211, 219, 0.2)',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(58, 211, 219, 0.2)',
    backgroundColor: '#FFFFFF',
    marginBottom: 24,
    gap: 8,
  },
  availabilityText: {
    fontSize: 14,
    color: '#A16207',
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
    minHeight: 44,
  },
  activeTabButton: {
    borderBottomWidth: 3,
    borderBottomColor: '#3ad3db',
  },
  tabButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  activeTabButtonText: {
    color: '#3ad3db',
    fontWeight: '700',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '30%',
    right: '30%',
    height: 3,
    backgroundColor: '#3ad3db',
    borderRadius: 2,
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  serviceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    color: '#F59E0B',
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
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
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
  
  // Video styles
  videosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 24,
  },
  videoCard: {
    width: (width - 40 - 16) / 2, // 2 columns within tabContent padding and gap
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  videoThumbnailContainer: {
    position: 'relative',
    height: 124,
    backgroundColor: '#F2F2F7',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoStats: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  videoStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  videoStatText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  videoInfo: {
    padding: 12,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 18,
  },
  videoDate: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
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
});

export default CleanerProfileScreen; 