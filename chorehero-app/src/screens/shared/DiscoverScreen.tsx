import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StyleSheet,
  Dimensions,
  StatusBar,
  FlatList,
  ActivityIndicator,
  Animated,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import FloatingNavigation from '../../components/FloatingNavigation';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { useLocationContext } from '../../context/LocationContext';
import { supabase } from '../../services/supabase';
import { categoryService, CategoryService, CategoryCleaner } from '../../services/category';
import { contentService } from '../../services/contentService';
import { guestModeService, GuestService } from '../../services/guestModeService';



type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
  SimpleBookingFlow: {
    serviceId: string;
    serviceName: string;
    basePrice: number;
    duration: number;
  };
  NotificationsScreen: undefined;
};

type DiscoverScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Discover'>;

interface DiscoverScreenProps {
  navigation: DiscoverScreenNavigationProp;
}

const { width } = Dimensions.get('window');

interface Service {
  id: string;
  title: string;
  image: string;
  rating: number;
  reviews: number;
  duration: string;
  price: number;
  category: string;
}

interface Cleaner {
  id: string;
  name: string;
  image: string;
  rating: number;
  specialty: string;
}

interface DatabaseCleaner {
  id: string;
  name: string;
  avatar_url: string;
  cleaner_profiles: {
    rating_average: number;
    specialties: string[];
  };
}

interface VideoContent {
  id: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url?: string;
  user: {
    id: string;
    name: string;
    avatar_url: string;
    role: string;
  };
  view_count: number;
  like_count: number;
  created_at: string;
}

const DiscoverScreen: React.FC<DiscoverScreenProps> = ({ navigation }) => {
  const [selectedCategory, setSelectedCategory] = useState('Featured');
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingCleaners, setTrendingCleaners] = useState<CategoryCleaner[]>([]);
  const [popularServices, setPopularServices] = useState<CategoryService[]>([]);
  const [recommendedServices, setRecommendedServices] = useState<CategoryService[]>([]);
  const [featuredVideos, setFeaturedVideos] = useState<VideoContent[]>([]);
  const [serviceCategories, setServiceCategories] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(3);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [imageLoadingStates, setImageLoadingStates] = useState<{[key: string]: boolean}>({});
  const [useMockData, setUseMockData] = useState(false); // Always use real data
  // Demo mode removed
  const [locationText, setLocationText] = useState('Getting location...');

  // Animation values for micro-interactions
  const cardScaleAnim = new Animated.Value(1);
  const buttonScaleAnim = new Animated.Value(1);

  // Location context
  const { location } = useLocationContext();

  // Load initial data
  useEffect(() => {
    loadCategoryData('Featured');
    loadServiceCategories();
  }, []);

  // Load data when category changes
  useEffect(() => {
    if (selectedCategory) {
      loadCategoryData(selectedCategory);
    }
  }, [selectedCategory]);

  // Reload data when mock data toggle changes
  useEffect(() => {
    loadCategoryData(selectedCategory);
    loadServiceCategories();
  }, [useMockData]);

  // Update location text when location changes
  useEffect(() => {
    if (location) {
      // For demo purposes, we'll use a reverse geocoding simulation
      // In production, you'd use a real reverse geocoding service
      const simulateReverseGeocode = () => {
        const locations = [
          'San Francisco, CA',
          'Los Angeles, CA', 
          'New York, NY',
          'Austin, TX',
          'Seattle, WA',
          'Miami, FL'
        ];
        // Use coordinates to pick a consistent location
        const index = Math.floor((location.latitude + location.longitude) * 1000) % locations.length;
        return locations[Math.abs(index)];
      };
      
      setLocationText(simulateReverseGeocode());
    } else {
      setLocationText('Location unavailable');
    }
  }, [location]);

  const loadFeaturedVideos = async () => {
    try {
      setLoadingVideos(true);
      console.log('🎬 Loading featured videos for Discover tab...');

      // Get videos from the real content service
      const response = await contentService.getFeed({
        filters: { content_type: 'video' },
        sort_by: 'recent',
        limit: 6 // Show 6 featured videos
      });

      if (response.success && response.data?.posts) {
        const videos = response.data.posts.map((post: any) => ({
          id: post.id,
          title: post.title || 'Cleaning Video',
          description: post.description || '',
          media_url: post.media_url,
          thumbnail_url: post.thumbnail_url,
          user: post.user,
          view_count: post.view_count || 0,
          like_count: post.like_count || 0,
          created_at: post.created_at
        }));

        console.log(`✅ Loaded ${videos.length} real featured videos`);
        setFeaturedVideos(videos);
      } else {
        console.log('📭 No real videos found - showing empty state');
        setFeaturedVideos([]);
      }
    } catch (error) {
      console.error('❌ Error loading featured videos:', error);
      setFeaturedVideos([]);
    } finally {
      setLoadingVideos(false);
    }
  };

  const loadServiceCategories = async () => {
    try {
      console.log('🏠 Loading service categories...');
      const categories = await guestModeService.getGuestServiceCategories();
      setServiceCategories(categories);
      console.log(`✅ Loaded ${categories.length} service categories`);
    } catch (error) {
      console.error('❌ Error loading service categories:', error);
      setServiceCategories([]);
    }
  };

  const loadCategoryData = async (category: string) => {
    try {
      setLoadingServices(true);

      // Load videos regardless of mock data mode
      await loadFeaturedVideos();

      if (useMockData) {
        // Load all three sections in parallel
        const [cleanersResponse, servicesResponse, recommendedResponse] = await Promise.all([
          categoryService.getCleanersBySpecialty(category),
          categoryService.getServicesByCategory(category),
          categoryService.getRecommendedServices(undefined, category)
        ]);

        if (cleanersResponse.success) {
          setTrendingCleaners(cleanersResponse.data);
        }

        if (servicesResponse.success) {
          setPopularServices(servicesResponse.data);
        }

        if (recommendedResponse.success) {
          setRecommendedServices(recommendedResponse.data);
          // TODO: In future implementation, filter recommendations based on liked videos
          // from the video feed. For now, using category-based recommendations.
        }
      } else {
        // For production mode, try to load real data but fallback to enhanced mock
        console.log('📱 Loading real data for production mode...');
        const [cleanersResponse, servicesResponse, recommendedResponse] = await Promise.all([
          categoryService.getCleanersBySpecialty(category),
          categoryService.getServicesByCategory(category),
          categoryService.getRecommendedServices(undefined, category)
        ]);

        if (cleanersResponse.success) {
          setTrendingCleaners(cleanersResponse.data);
        }

        if (servicesResponse.success) {
          setPopularServices(servicesResponse.data);
        }

        if (recommendedResponse.success) {
          setRecommendedServices(recommendedResponse.data);
        }
      }

    } catch (error) {
      console.error('Error loading category data:', error);
      // Set empty data on error when not using mock data
      if (!useMockData) {
        setTrendingCleaners([]);
        setPopularServices([]);
        setRecommendedServices([]);
      }
    } finally {
      setLoadingServices(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Add useEffect to focus search input when screen is focused (when coming from home search)
    const unsubscribe = navigation.addListener('focus', () => {
      // Check if the navigation state includes a previous screen that had a search query
      // This is a simplified check; a more robust solution might involve a stack history
      // For now, we'll assume if we are navigating to Discover from Home, we want to focus the search
      // A more accurate check would involve checking the previous screen's route name
      // For this example, we'll just focus if the navigation state is not empty
      if (navigation.getState().routes.length > 1) {
        // This means we are navigating from a screen that was not the Home screen
        // We can check the previous screen's route name to be more precise
        const previousScreen = navigation.getState().routes[navigation.getState().routes.length - 2];
        if (previousScreen.name === 'Home') {
          // Focus the search input
          // This requires a ref to the TextInput, which is not directly available here
          // For now, we'll just set the state, which will trigger a re-render
          // A more robust solution would involve a ref to the TextInput
          setSearchQuery(''); // Clear previous query if coming from home
        }
      }
    });

    return unsubscribe;
  }, [navigation]);

  const handleImageLoad = (imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: false }));
  };

  const handleImageLoadStart = (imageId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [imageId]: true }));
  };

  const handleCardPress = () => {
    Animated.sequence([
      Animated.timing(cardScaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(cardScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const categories = [
    'Featured',
    'Kitchen',
    'Bathroom',
    'Living Room',
    'Bedroom',
    'Outdoors',
  ];

  const renderCategoryTab = (category: string) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.categoryTab,
        selectedCategory === category && styles.categoryTabActive,
      ]}
      onPress={() => setSelectedCategory(category)}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.categoryTabText,
        selectedCategory === category && styles.categoryTabTextActive,
      ]}>
        {category}
      </Text>
    </TouchableOpacity>
  );

  const renderServiceCard = (service: CategoryService, isPopular = false) => {
    const isLoading = imageLoadingStates[service.id] !== false;
    
    return (
      <Animated.View
        key={service.id}
        style={[
          styles.serviceCard,
          isPopular && styles.popularServiceCard,
          { transform: [{ scale: cardScaleAnim }] }
        ]}
      >
        <TouchableOpacity
          style={styles.serviceImageContainer}
          onPress={handleCardPress}
          activeOpacity={0.9}
        >
          <Image 
            source={{ uri: service.image || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80' }} 
            style={styles.serviceImage}
            onLoadStart={() => handleImageLoadStart(service.id)}
            onLoad={() => handleImageLoad(service.id)}
          />
          
          {/* Loading Skeleton */}
          {isLoading && (
            <View style={styles.imageSkeleton}>
              <ActivityIndicator size="small" color="#3ad3db" />
            </View>
          )}
          
          {/* Enhanced Gradient Overlay - Top to Bottom */}
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            style={styles.serviceGradientOverlay}
          />
          
          {/* Star Rating Badge */}
          <View style={styles.serviceBadge}>
            <Ionicons name="star" size={12} color="#FFC93C" />
            <Text style={styles.serviceBadgeText}>{service.rating?.toFixed(1) || '4.5'}</Text>
          </View>
          
          {/* Service Title - Bottom Left */}
          <Text style={styles.serviceTitleOverlay}>{service.name}</Text>
          
          {/* Price and Duration */}
          <Text style={styles.servicePriceOverlay}>${service.base_price} • {Math.floor(service.estimated_duration / 60)}h</Text>
          
          {/* Book Button - Bottom Center */}
          <Animated.View style={[styles.browseButtonContainer, { transform: [{ scale: buttonScaleAnim }] }]}>
            <TouchableOpacity 
              style={styles.browseButtonOverlay}
              onPress={() => {
                // Navigate to booking flow with service details
                navigation.navigate('SimpleBookingFlow', {
                  serviceId: service.id,
                  serviceName: service.name,
                  basePrice: service.base_price,
                  duration: service.estimated_duration
                });
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.browseButtonText}>Book</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTrendingCleanerCard = (cleaner: CategoryCleaner) => (
    <TouchableOpacity 
      key={cleaner.id} 
      style={styles.trendingCleanerCard}
      onPress={() => navigation.navigate('CleanerProfile', { cleanerId: cleaner.id })}
      activeOpacity={0.7}
    >
      <View style={styles.trendingCleanerImageContainer}>
        <Image 
          source={{ uri: cleaner.avatar_url }} 
          style={styles.trendingCleanerImage}
          onLoadStart={() => handleImageLoadStart(cleaner.id)}
          onLoad={() => handleImageLoad(cleaner.id)}
        />
        {imageLoadingStates[cleaner.id] && (
          <View style={styles.cleanerImageSkeleton}>
            <ActivityIndicator size="small" color="#3ad3db" />
          </View>
        )}
        <View style={styles.trendingCleanerRing} />
      </View>
      <Text style={styles.trendingCleanerName}>{cleaner.name}</Text>
      <View style={styles.trendingCleanerRating}>
        <Ionicons name="star" size={12} color="#FFC93C" />
        <Text style={styles.trendingCleanerRatingText}>{cleaner.rating_average.toFixed(1)}</Text>
      </View>
      <Text style={styles.trendingCleanerSpecialty}>{cleaner.specialties[0] || 'Professional Cleaner'}</Text>
    </TouchableOpacity>
  );

  const renderVideoCard = (video: VideoContent) => (
    <TouchableOpacity 
      key={video.id} 
      style={styles.videoCard}
      onPress={() => {
        // Navigate to booking flow for this cleaner
        console.log('🎯 Booking from Discover video:', video.user?.name);
        navigation.navigate('SimpleBookingFlow', {
          cleanerId: video.user?.id || 'demo-cleaner',
          serviceName: video.title,
          fromVideoFeed: true
        });
      }}
    >
      <View style={styles.videoThumbnailContainer}>
        <Image 
          source={{ uri: video.thumbnail_url || video.media_url }} 
          style={styles.videoThumbnail}
          onLoadStart={() => handleImageLoadStart(video.id)}
          onLoad={() => handleImageLoad(video.id)}
        />
        {imageLoadingStates[video.id] && (
          <View style={styles.videoImageSkeleton}>
            <ActivityIndicator size="small" color="#3ad3db" />
          </View>
        )}
        
        {/* Play icon overlay */}
        <View style={styles.videoPlayOverlay}>
          <View style={styles.videoPlayButton}>
            <Ionicons name="play" size={16} color="#FFFFFF" />
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
        <TouchableOpacity 
          style={styles.videoCreator}
          onPress={(e) => {
            // Stop event propagation to prevent video booking
            e.stopPropagation();
            console.log('🔍 Discover: Navigating to CleanerProfile with ID:', video.user.id);
            navigation.navigate('CleanerProfile', { cleanerId: video.user.id });
          }}
        >
          <Image 
            source={{ uri: video.user.avatar_url }} 
            style={styles.videoCreatorAvatar}
          />
          <Text style={styles.videoCreatorName}>{video.user.name}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderServiceCategoryCard = (service: GuestService) => (
    <TouchableOpacity 
      key={service.id}
      style={styles.serviceCategoryCard}
      onPress={() => {
        console.log('🏠 Service category selected:', service.name);
        navigation.navigate('ServiceDetail', {
          serviceId: service.id,
          serviceName: service.name,
          category: service.category
        });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.serviceCategoryImageContainer}>
        <Image 
          source={{ uri: service.image_url }} 
          style={styles.serviceCategoryImage}
          onLoadStart={() => handleImageLoadStart(service.id)}
          onLoad={() => handleImageLoad(service.id)}
        />
        {imageLoadingStates[service.id] && (
          <View style={styles.serviceCategoryImageSkeleton}>
            <ActivityIndicator size="small" color="#3ad3db" />
          </View>
        )}
        
        {/* Rating overlay */}
        <View style={styles.serviceCategoryRatingOverlay}>
          <View style={styles.serviceCategoryRatingBadge}>
            <Ionicons name="star" size={12} color="#FFC93C" />
            <Text style={styles.serviceCategoryRatingText}>{service.rating}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.serviceCategoryContent}>
        <Text style={styles.serviceCategoryTitle}>{service.name}</Text>
        <Text style={styles.serviceCategoryDescription} numberOfLines={2}>
          {service.description}
        </Text>
        <View style={styles.serviceCategoryFooter}>
          <Text style={styles.serviceCategoryPrice}>{service.price_range}</Text>
          <TouchableOpacity 
            style={styles.serviceCategoryButton}
            onPress={() => {
              console.log('🎯 Browse cleaners for:', service.name);
              // Navigate to service detail with cleaners list
              navigation.navigate('ServiceDetail', {
                serviceId: service.id,
                serviceName: service.name,
                category: service.category
              });
            }}
          >
            <Text style={styles.serviceCategoryButtonText}>Browse Cleaners</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9F9" />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="#8E8E93" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search services, cleaners, or tasks"
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#8E8E93"
            />
          </View>
          
          <TouchableOpacity style={styles.locationPill} activeOpacity={0.7}>
            <View style={styles.locationIconContainer}>
              <Text style={styles.locationEmoji}>📍</Text>
              <View style={styles.locationDot} />
            </View>
            <Text style={styles.locationText}>{locationText}</Text>
            <Ionicons name="chevron-down" size={12} color="#00BFA6" />
          </TouchableOpacity>
        </View>
        
        {/* Header Controls */}
        <View style={styles.headerControls}>
          {false && ( // Demo mode removed
            <View style={styles.demoToggle}>
              <Text style={styles.demoToggleLabel}>Demo</Text>
              <Switch 
                value={useMockData} 
                onValueChange={setUseMockData}
                trackColor={{ false: '#D1D5DB', true: '#3ad3db' }}
                thumbColor={useMockData ? '#ffffff' : '#f4f3f4'}
                ios_backgroundColor="#D1D5DB"
                style={styles.switch}
              />
            </View>
          )}
          <TouchableOpacity 
            style={styles.notificationButton} 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('NotificationsScreen')}
          >
            <Ionicons name="notifications-outline" size={24} color="#1C1C1E" />
            {hasUnreadNotifications && <View style={styles.notificationBadge} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Filter Tabs */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {categories.map(renderCategoryTab)}
          </ScrollView>
        </View>

        {/* Featured Videos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Videos</Text>
          {loadingVideos ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3ad3db" />
              <Text style={styles.loadingText}>Loading videos...</Text>
            </View>
          ) : featuredVideos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.videosContainer}
            >
              {featuredVideos.map(renderVideoCard)}
            </ScrollView>
          ) : (
            <EmptyState 
              {...EmptyStateConfigs.videoFeed}
              title="No videos available"
              subtitle="Videos from cleaners will appear here when they start sharing their work."
              showFeatures={true}
              actions={[]}
            />
          )}
        </View>

        {/* Service Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Services</Text>
          {serviceCategories.length > 0 ? (
            <View style={styles.serviceCategoriesGrid}>
              {serviceCategories.map(renderServiceCategoryCard)}
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3ad3db" />
              <Text style={styles.loadingText}>Loading services...</Text>
            </View>
          )}
        </View>

        {/* Additional Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>More Services</Text>
          {popularServices.length > 0 ? (
            <View style={styles.popularServicesGrid}>
              {popularServices.map(service => renderServiceCard(service, true))}
            </View>
          ) : !useMockData ? (
            <EmptyState 
              {...EmptyStateConfigs.savedServices}
              title="No services available"
              subtitle="Services will appear here when cleaners in your area add their offerings."
              showFeatures={true}
              actions={[]}
            />
          ) : null}
        </View>

        {/* Trending Cleaners */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Trending {selectedCategory !== 'Featured' ? selectedCategory : ''} Cleaners
          </Text>
          {loading || loadingServices ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3ad3db" />
              <Text style={styles.loadingText}>Loading cleaners...</Text>
            </View>
          ) : trendingCleaners.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trendingCleanersContainer}
            >
              {trendingCleaners.map(renderTrendingCleanerCard)}
            </ScrollView>
          ) : !useMockData ? (
            <EmptyState 
              {...EmptyStateConfigs.savedCleaners}
              title="No cleaners available"
              subtitle="Cleaners will appear here when professionals join your area."
              showFeatures={true}
              actions={[]}
            />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No cleaners found for {selectedCategory}</Text>
            </View>
          )}
        </View>

        {/* Recommended For You */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended For You</Text>
          {recommendedServices.length > 0 ? (
            <View style={styles.recommendedServicesContainer}>
              {recommendedServices.map(service => renderServiceCard(service, false))}
            </View>
          ) : !useMockData ? (
            <EmptyState 
              {...EmptyStateConfigs.recentActivity}
              title="No recommendations yet"
              subtitle="Like videos and book services to get personalized recommendations based on your preferences."
              showFeatures={true}
              actions={[
                {
                  label: 'Watch Videos',
                  onPress: () => navigation.navigate('Home'),
                  icon: 'videocam',
                  primary: true,
                }
              ]}
            />
          ) : null}
        </View>

        {/* Special Offers Banner */}
        <View style={styles.section}>
          <View style={styles.specialOfferCard}>
            <LinearGradient
              colors={['#3ad3db', '#1ca7b7']}
              style={styles.specialOfferGradient}
            >
              <View style={styles.specialOfferContent}>
                <Text style={styles.specialOfferTitle}>25% OFF First Booking</Text>
                <Text style={styles.specialOfferSubtitle}>Use code HERO25 at checkout</Text>
                <TouchableOpacity 
                  style={styles.claimOfferButton}
                  onPress={handleButtonPress}
                  activeOpacity={0.8}
                >
                  <Text style={styles.claimOfferButtonText}>Claim Offer</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Bottom spacing for navigation */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      
      {/* Floating Navigation */}
      <FloatingNavigation navigation={navigation} currentScreen="Discover" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  topBar: {
    backgroundColor: '#F9F9F9',
    paddingTop: 80,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  searchSection: {
    flex: 1,
    marginRight: 16,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 14,
    zIndex: 1,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingLeft: 48,
    paddingRight: 16,
    fontSize: 16,
    color: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  locationIconContainer: {
    position: 'relative',
    marginRight: 6,
  },
  locationEmoji: {
    fontSize: 18,
  },
  locationDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  locationText: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '600',
    marginRight: 4,
  },
  headerControls: {
    alignItems: 'flex-start',
    gap: 12,
  },
  demoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  demoToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginRight: 8,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
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
  scrollView: {
    flex: 1,
  },
  filterSection: {
    paddingVertical: 12,
  },
  filterContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryTabActive: {
    backgroundColor: '#3ad3db',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  popularServicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 16,
  },
  serviceCard: {
    width: (width - 56) / 2,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  popularServiceCard: {
    height: 220,
  },
  serviceImageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  imageSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  serviceBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  serviceBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  serviceTitleOverlay: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  servicePriceOverlay: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    right: 16,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  browseButtonContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  browseButtonOverlay: {
    backgroundColor: '#3ad3db',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  trendingCleanersContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  trendingCleanerCard: {
    width: 120,
    alignItems: 'center',
  },
  trendingCleanerImageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  trendingCleanerImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  cleanerImageSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F2F2F7',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingCleanerRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#3ad3db',
    opacity: 0.3,
  },
  trendingCleanerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
    textAlign: 'center',
  },
  trendingCleanerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  trendingCleanerRatingText: {
    fontSize: 12,
    color: '#8E8E93',
    marginLeft: 2,
  },
  trendingCleanerSpecialty: {
    fontSize: 12,
    color: '#3ad3db',
    textAlign: 'center',
  },
  recommendedServicesContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  recommendationReason: {
    marginTop: -8,
    marginBottom: 8,
  },
  recommendationReasonText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  specialOfferCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  specialOfferGradient: {
    padding: 24,
  },
  specialOfferContent: {
    alignItems: 'center',
  },
  specialOfferTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  specialOfferSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
    opacity: 0.9,
  },
  claimOfferButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  claimOfferButtonText: {
    color: '#3ad3db',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 100,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 14,
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  
  // Video card styles
  videosContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 16,
  },
  videoCard: {
    width: 140,
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
    height: 100,
    backgroundColor: '#F2F2F7',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoImageSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    marginBottom: 8,
    lineHeight: 18,
  },
  videoCreator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoCreatorAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  videoCreatorName: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  // Service Category Card Styles
  serviceCategoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  serviceCategoryCard: {
    width: (width - 56) / 2, // 2 cards per row with proper spacing
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  serviceCategoryImageContainer: {
    position: 'relative',
    width: '100%',
    height: 140,
  },
  serviceCategoryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  serviceCategoryImageSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceCategoryRatingOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  serviceCategoryRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  serviceCategoryRatingText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  serviceCategoryContent: {
    padding: 12,
  },
  serviceCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
    lineHeight: 20,
  },
  serviceCategoryDescription: {
    fontSize: 13,
    color: '#6D6D70',
    lineHeight: 18,
    marginBottom: 12,
  },
  serviceCategoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceCategoryPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3ad3db',
  },
  serviceCategoryButton: {
    backgroundColor: '#3ad3db',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  serviceCategoryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default DiscoverScreen; 