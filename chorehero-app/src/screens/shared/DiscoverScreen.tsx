import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
  ActionSheetIOS,
  Platform,
  Modal,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { NavigationProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import FloatingNavigation from '../../components/FloatingNavigation';
import { EmptyState, EmptyStateConfigs } from '../../components/EmptyState';
import { useLocationContext } from '../../context/LocationContext';
import { supabase } from '../../services/supabase';
import { categoryService, CategoryService, CategoryCleaner } from '../../services/category';
import { contentService } from '../../services/contentService';
import { guestModeService, GuestService } from '../../services/guestModeService';
import { serviceDiscoveryService } from '../../services/serviceDiscoveryService';
import { exploreService, ExploreProviderRow, ExploreSortOrder } from '../../services/exploreService';
import { TutorialOverlay } from '../../components/TutorialOverlay';
import { useTutorial } from '../../hooks/useTutorial';
import { ServiceCard } from '../../components/ServiceCard';
import { serviceCardService } from '../../services/serviceCardService';
import { ServiceCardData } from '../../types/serviceCard';
import { zipLookupService } from '../../services/zipLookupService';



type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
  NewBookingFlow: {
    cleanerId?: string;
    serviceType?: string;
    serviceName?: string;
    basePrice?: number;
  };
  ServiceDetail: {
    serviceId: string;
    serviceName: string;
    category: string;
  };
  NotificationsScreen: undefined;
};

type DiscoverScreenNavigationProp = NavigationProp<TabParamList>;

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

interface SearchState {
  query_buffer: string;
  active_filters: {
    service_tags?: string[];
    price_range?: [number, number];
    distance_miles?: number;
  };
  sort_order: ExploreSortOrder;
  result_cache: string[];
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
  const [searchState, setSearchState] = useState<SearchState>({
    query_buffer: '',
    active_filters: {},
    sort_order: 'rating',
    result_cache: [],
  });
  const [searchResults, setSearchResults] = useState<ExploreProviderRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [trendingCleaners, setTrendingCleaners] = useState<CategoryCleaner[]>([]);
  const [popularServices, setPopularServices] = useState<CategoryService[]>([]);
  const [recommendedServices, setRecommendedServices] = useState<CategoryService[]>([]);
  const [featuredVideos, setFeaturedVideos] = useState<VideoContent[]>([]);
  const [serviceCategories, setServiceCategories] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingServices, setLoadingServices] = useState(false);
  const [couponClaimed, setCouponClaimed] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [videoCategories, setVideoCategories] = useState<string[]>(['Featured']);
  const [imageLoadingStates, setImageLoadingStates] = useState<{[key: string]: boolean}>({});
  const [useMockData, setUseMockData] = useState(false); // Always use real data
  // Demo mode removed
  const [locationText, setLocationText] = useState('Getting location...');
  const [storedCity, setStoredCity] = useState<string | null>(null);
  const [storedState, setStoredState] = useState<string | null>(null);
  const [storedZip, setStoredZip] = useState<string | null>(null);
  const [zipModalVisible, setZipModalVisible] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [isResolvingZip, setIsResolvingZip] = useState(false);

  // Animation values for micro-interactions
  const cardScaleAnim = new Animated.Value(1);
  const buttonScaleAnim = new Animated.Value(1);

  // Location context
  const { location } = useLocationContext();
  
  // Animation for claim button
  const claimButtonScale = useRef(new Animated.Value(1)).current;
  
  // Tutorial system
  const { 
    currentTutorial, 
    currentStepIndex, 
    isActive: isTutorialActive,
    nextStep, 
    completeTutorial, 
    skipTutorial,
    triggerTutorial 
  } = useTutorial();

  // Load video categories from uploaded videos
  const loadVideoCategories = async () => {
    try {
      // Fetch videos with tags from content_posts table
      const { data, error } = await supabase
        .from('content_posts')
        .select('tags')
        .eq('content_type', 'video')
        .eq('status', 'published')
        .not('tags', 'is', null);
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        // Flatten all tags from all videos and get unique ones
        const allTags: string[] = data.flatMap(v => v.tags || []);
        const uniqueTags = [...new Set(allTags)].filter(Boolean);
        
        // Format category names (capitalize, replace underscores)
        const formattedCategories = uniqueTags.map(tag => 
          tag.split('_').map((word: string) => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          ).join(' ')
        );
        
        // Always include 'Featured' first, then add unique categories
        if (formattedCategories.length > 0) {
          setVideoCategories(['Featured', ...formattedCategories]);
        }
      }
    } catch (error) {
      console.log('Using default categories - no videos uploaded yet');
      // Keep default categories if no videos exist
    }
  };

  // Load initial data
  useEffect(() => {
    loadCategoryData('Featured');
    loadServiceCategories();
    loadVideoCategories();
    // Start subtle claim button animation
    startClaimButtonAnimation();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchState(prev => ({ ...prev, query_buffer: searchQuery }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchState.query_buffer && !searchState.active_filters.service_tags) {
      setSearchResults([]);
      setSearchState(prev => ({ ...prev, result_cache: [] }));
      return;
    }

    const runSearch = async () => {
      setIsSearching(true);
      const response = await exploreService.searchProviders({
        query: searchState.query_buffer,
        filters: {
          service_tags: searchState.active_filters.service_tags,
          price_range: searchState.active_filters.price_range,
        },
        sort_by: searchState.sort_order,
        limit: 30,
      });
      if (response.success && response.data) {
        setSearchResults(response.data);
        setSearchState(prev => ({
          ...prev,
          result_cache: response.data.map(row => row.provider_id),
        }));
      } else {
        setSearchResults([]);
      }
      setIsSearching(false);
    };

    runSearch();
  }, [searchState.query_buffer, searchState.active_filters.service_tags, searchState.active_filters.price_range, searchState.sort_order]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      setSearchQuery('');
      setSearchResults([]);
      setSearchState({
        query_buffer: '',
        active_filters: {},
        sort_order: 'rating',
        result_cache: [],
      });
      setZipModalVisible(false);
    });
    return unsubscribe;
  }, [navigation]);

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

  useEffect(() => {
    const loadStoredLocation = async () => {
      try {
        const city = await AsyncStorage.getItem('guest_city');
        const state = await AsyncStorage.getItem('guest_state');
        const zip = await AsyncStorage.getItem('guest_zip');
        setStoredCity(city);
        setStoredState(state);
        setStoredZip(zip);
      } catch {
        setStoredCity(null);
        setStoredState(null);
        setStoredZip(null);
      }
    };
    loadStoredLocation();
  }, []);

  // Update location text when location changes
  useEffect(() => {
    const resolveLocationText = async () => {
      if (storedZip) {
        if (storedCity) {
          setLocationText(`${storedCity}, ${storedZip}`);
          return;
        }
        setLocationText(`ZIP ${storedZip}`);
        return;
      }
      if (location) {
        try {
          const result = await Location.reverseGeocodeAsync({
            latitude: location.latitude,
            longitude: location.longitude,
          });
          const place = result?.[0];
          const city = place?.city || place?.subregion;
          const postalCode = place?.postalCode;
          if (city && postalCode) {
            setLocationText(`${city}, ${postalCode}`);
            return;
          }
          if (postalCode) {
            setLocationText(`ZIP ${postalCode}`);
            return;
          }
          if (city) {
            setLocationText(city);
            return;
          }
        } catch {
          // ignore and fallback below
        }
      }
      setLocationText('Location unavailable');
    };
    resolveLocationText();
  }, [location, storedCity, storedZip]);

  const loadFeaturedVideos = async (category?: string) => {
    try {
      setLoadingVideos(true);
      console.log(`🎬 Loading videos for category: ${category || 'Featured'}...`);

      // No mock videos - only show real uploaded content
      console.log('🎬 Loading real videos only (no mock data)');

      // Build filters for content service
      const filters: any = { content_type: 'video' };
      
      // If a specific category is selected (not "Featured"), filter by that tag
      if (category && category !== 'Featured') {
        // Convert display name back to tag format (e.g., "Living Room" -> "living_room")
        const tagFormat = category.toLowerCase().replace(/\s+/g, '_');
        filters.tags = [tagFormat];
      }

      // For authenticated users, get videos from the real content service
      const response = await contentService.getFeed({
        filters,
        sort_by: category === 'Featured' ? 'popular' : 'recent',
        limit: 6 // Show 6 featured videos
      });

      if (response.success && response.data?.posts && response.data.posts.length > 0) {
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

        console.log(`✅ Loaded ${videos.length} real videos for category: ${category || 'Featured'}`);
        setFeaturedVideos(videos);
      } else {
        console.log(`📭 No videos found for category: ${category || 'Featured'}`);
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
      
      // Check if user is guest, then decide data source
      const isGuest = await guestModeService.isGuestUser();
      
      if (isGuest) {
        // Guest user - use guest mode categories
        console.log('👤 Guest user detected, loading guest categories');
        const categories = await guestModeService.getGuestServiceCategories();
        setServiceCategories(categories);
        console.log(`✅ Loaded ${categories.length} guest service categories`);
      } else {
        // Real user - use service discovery service with real data
        console.log('🔄 Real user detected, loading real service categories');
        const response = await serviceDiscoveryService.getServiceCategories();
        
        if (response.success && response.data) {
          // Transform real service categories to match UI format
          const transformedCategories = response.data.map(category => ({
            id: category.id,
            title: category.name,
            description: category.description,
            image: category.image,
            cleaners_count: category.cleaners_count,
            avg_rating: category.avg_rating,
            starting_price: category.starting_price
          }));
          
          setServiceCategories(transformedCategories);
          console.log(`✅ Loaded ${transformedCategories.length} real service categories`);
        } else {
          // Fallback to guest categories if real data fails
          console.log('⚠️ Failed to load real categories, falling back to guest mode');
          const categories = await guestModeService.getGuestServiceCategories();
          setServiceCategories(categories);
        }
      }
    } catch (error) {
      console.error('❌ Error loading service categories:', error);
      // Fallback to guest categories on error
      const categories = await guestModeService.getGuestServiceCategories();
      setServiceCategories(categories);
    }
  };

  const loadCategoryData = async (category: string) => {
    try {
      setLoadingServices(true);

      // Load videos filtered by the selected category
      await loadFeaturedVideos(category);

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

        if (servicesResponse.success && servicesResponse.data.length > 0) {
          setPopularServices(servicesResponse.data);
        } else {
          const guestServices = await guestModeService.getGuestServiceCategories();
          setPopularServices(guestServices);
        }

        if (recommendedResponse.success && recommendedResponse.data.length > 0) {
          setRecommendedServices(recommendedResponse.data);
        } else {
          const guestServices = await guestModeService.getGuestServiceCategories();
          setRecommendedServices(guestServices.slice(0, 6));
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

        if (servicesResponse.success && servicesResponse.data.length > 0) {
          setPopularServices(servicesResponse.data);
        } else {
          const guestServices = await guestModeService.getGuestServiceCategories();
          setPopularServices(guestServices);
        }

        if (recommendedResponse.success && recommendedResponse.data.length > 0) {
          setRecommendedServices(recommendedResponse.data);
        } else {
          const guestServices = await guestModeService.getGuestServiceCategories();
          setRecommendedServices(guestServices.slice(0, 6));
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

  const persistZipLocation = async (zip: string, city?: string | null, state?: string | null) => {
    await AsyncStorage.multiSet([
      ['guest_zip', zip],
      ['guest_city', city || ''],
      ['guest_state', state || ''],
    ]);
    setStoredZip(zip);
    setStoredCity(city || null);
    setStoredState(state || null);
    setLocationText(city ? `${city}, ${zip}` : `ZIP ${zip}`);
    loadCategoryData(selectedCategory);
  };

  const handleZipSubmit = async () => {
    const zip = zipInput.trim().replace(/\D/g, '').slice(0, 5);
    if (zip.length !== 5) {
      Alert.alert('Zip Code Required', 'Enter a valid 5-digit ZIP.');
      return;
    }
    setIsResolvingZip(true);
    try {
      const resolved = await zipLookupService.lookup(zip);
      await persistZipLocation(zip, resolved?.city || null, resolved?.state || null);
      setZipModalVisible(false);
    } catch {
      await persistZipLocation(zip, null, null);
      setZipModalVisible(false);
    } finally {
      setIsResolvingZip(false);
    }
  };

  const handleUseMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Services', 'Please enable location services in your device settings.');
        return;
      }
      const coords = await Location.getCurrentPositionAsync({});
      const results = await Location.reverseGeocodeAsync({
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
      });
      const place = results[0];
      if (!place?.postalCode) {
        Alert.alert('Location', 'Unable to resolve your ZIP code.');
        return;
      }
      await persistZipLocation(place.postalCode, place?.city || null, place?.region || null);
    } catch {
      Alert.alert('Location', 'Unable to use current location.');
    }
  };

  // Handle location picker press
  const handleLocationPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Use My Location', 'Enter ZIP Code', 'Cancel'],
          cancelButtonIndex: 2,
          title: 'Set your service ZIP',
          message: 'Use your current location or enter a ZIP code.',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            handleUseMyLocation();
          } else if (buttonIndex === 1) {
            setZipInput(storedZip || '');
            setZipModalVisible(true);
          }
        }
      );
    } else {
      Alert.alert(
        'Set your service ZIP',
        'Use your current location or enter a ZIP code.',
        [
          {
            text: 'Use My Location',
            onPress: handleUseMyLocation,
          },
          {
            text: 'Enter ZIP Code',
            onPress: () => {
              setZipInput(storedZip || '');
              setZipModalVisible(true);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const showCitySelector = () => {};
  const showMoreCities = () => {};

  // Check if there are cleaners in the selected area
  const checkCleanersInArea = async (area: string) => {
    try {
      // Query cleaners in the area (simplified check)
      const { data: cleaners, error } = await supabase
        .from('cleaner_profiles')
        .select('id, service_radius')
        .limit(1);

      if (error) throw error;

      if (!cleaners || cleaners.length === 0) {
        // No cleaners found in this area
        Alert.alert(
          'Coming Soon! 🚀',
          `We're expanding to ${area === 'current' ? 'your area' : area} soon! Be the first to know when ChoreHeroes are available.`,
          [
            { text: 'Notify Me', onPress: () => console.log('User wants notification for:', area) },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
      // If cleaners exist, the location is already set and services will show
    } catch (error) {
      console.log('Area check completed');
    }
  };

  // Start subtle button pulsing animation
  const startClaimButtonAnimation = () => {
    Animated.loop(
    Animated.sequence([
        Animated.timing(claimButtonScale, {
          toValue: 1.02,
          duration: 2000,
        useNativeDriver: true,
      }),
        Animated.timing(claimButtonScale, {
        toValue: 1,
          duration: 2000,
        useNativeDriver: true,
      }),
      ])
    ).start();
  };

  const handleButtonPress = () => {
    if (!couponClaimed) {
      // Apply coupon to user's account/session
      console.log('Applying HERO25 coupon...');
      // TODO: Save coupon to AsyncStorage or user account
      setCouponClaimed(true);
      
      // Show success feedback (you might want to add a toast here)
      console.log('Coupon successfully applied!');
    }
  };


  // Use dynamic categories from uploaded videos, fallback to Featured only if no videos
  const categories = videoCategories.length > 1 ? videoCategories : ['Featured'];

  const renderCategoryTab = (category: string) => (
    <TouchableOpacity
      key={category}
      style={[
        styles.categoryTab,
        selectedCategory === category && styles.categoryTabActive,
      ]}
      onPress={() => {
        setSelectedCategory(category);
        const tag = category === 'Featured' ? undefined : category.toLowerCase().replace(/\s+/g, '_');
        setSearchState(prev => ({
          ...prev,
          active_filters: {
            ...prev.active_filters,
            service_tags: tag ? [tag] : undefined,
          },
        }));
      }}
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

  const renderServiceCard = (service: CategoryService | GuestService, isPopular = false) => {
    // Transform service data to standardized service card format
    const cardData = serviceCardService.createServiceCard({
      id: service.id,
      title: service.name,
      description: service.description,
      category: service.category,
      base_price: (service as CategoryService).base_price ? (service as CategoryService).base_price * 100 : undefined, // Convert to cents
      price_range: (service as GuestService).price_range || ((service as CategoryService).base_price ? `$${(service as CategoryService).base_price}` : 'Contact for pricing'),
      duration: (service as CategoryService).estimated_duration ? `${Math.floor((service as CategoryService).estimated_duration / 60)} hours` : '2-3 hours',
      rating: service.rating || 4.8,
      reviews: (service as CategoryService).reviews || 0,
      custom_image: (service as any).image || (service as any).image_url,
      is_featured: isPopular
    });
    
    return (
      <ServiceCard
        key={service.id}
        data={cardData}
        variant={isPopular ? "featured" : "compact"}
        onPress={(data) => handleServicePress(data)}
        onSecondaryAction={(data) => handleSaveService(data)}
        style={{ marginBottom: isPopular ? 0 : 16 }}
      />
    );
  };

  // Handler functions for service card actions
  const handleServicePress = (cardData: ServiceCardData) => {
    if (cardData.actions.primary_action === 'browse_cleaners') {
      navigation.navigate('ServiceDetail', {
        serviceId: cardData.id,
        serviceName: cardData.title,
        category: cardData.category,
        ...cardData.actions.navigation_params
      });
    } else if (cardData.actions.primary_action === 'view_details') {
      const cleanerId = cardData.provider?.cleaner_id || cardData.actions?.navigation_params?.cleanerId || cardData.id;
      navigation.navigate('CleanerProfile', { cleanerId });
    } else if (cardData.actions.primary_action === 'book_now') {
      navigation.navigate('NewBookingFlow', {
        serviceId: cardData.id,
        serviceName: cardData.title,
        basePrice: cardData.pricing.base_price ? cardData.pricing.base_price / 100 : 0,
        duration: cardData.service_details.duration_minutes || 120
      });
    }
  };

  const handleSaveService = (cardData: ServiceCardData) => {
    // Handle save/bookmark functionality
    console.log('Saving service:', cardData.title);
    // TODO: Implement save service functionality
  };

  const handleVideoPress = (cardData: ServiceCardData) => {
    console.log('🎬 Discover: Opening video in feed mode:', cardData.id);
    
    // Navigate to VideoFeed with featured videos
    // Pass the featured videos array and the initial video to start on
    navigation.navigate('VideoFeed' as any, {
      source: 'featured',
      initialVideoId: cardData.id,
      videos: featuredVideos.map(v => ({ id: v.id })), // Pass video IDs for ordering
    });
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

  const renderVideoCard = (video: VideoContent) => {
    // Transform video data to standardized service card format
    const videoCardData = serviceCardService.createVideoServiceCard({
      id: video.id,
      title: video.title,
      description: video.description || 'Professional cleaning demonstration',
      category: 'general', // Could be enhanced to detect category from video
      video_url: video.media_url,
      thumbnail_url: video.thumbnail_url || video.media_url,
      cleaner_id: video.user.id,
      cleaner_name: video.user.name,
      cleaner_avatar: video.user.avatar_url,
      view_count: video.view_count || 0,
      like_count: video.like_count || 0
    });

    return (
      <ServiceCard
        key={video.id}
        data={videoCardData}
        variant="video"
        onPress={(data) => handleVideoPress(data)}
        style={styles.featuredVideoCard}
      />
    );
  };

  const renderServiceCategoryCard = (service: GuestService) => {
  const renderSearchResult = ({ item }: { item: ExploreProviderRow }) => {
    return (
      <TouchableOpacity
        style={styles.searchResultCard}
        onPress={() => navigation.navigate('CleanerProfile', { cleanerId: item.provider_id })}
        activeOpacity={0.7}
      >
        <View style={styles.searchResultHeader}>
          <View style={styles.searchResultIdentity}>
            {item.provider_avatar_url ? (
              <Image source={{ uri: item.provider_avatar_url }} style={styles.searchResultAvatar} />
            ) : (
              <View style={styles.searchResultAvatarFallback}>
                <Text style={styles.searchResultAvatarText}>
                  {item.provider_name?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              </View>
            )}
            <Text style={styles.searchResultTitle}>{item.provider_name || 'Cleaner'}</Text>
          </View>
          <View style={styles.searchResultRating}>
            <Ionicons name="star" size={14} color="#FFC93C" />
            <Text style={styles.searchResultRatingText}>
              {item.avg_rating ? Number(item.avg_rating).toFixed(1) : 'New'}
            </Text>
          </View>
        </View>
        <Text style={styles.searchResultMeta}>
          {item.price_tiers?.length ? `Price tiers: ${item.price_tiers.join(', ')}` : 'Pricing not set'}
        </Text>
      </TouchableOpacity>
    );
  };
    // Transform guest service to standardized service card format
    const serviceCategoryCardData = serviceCardService.createServiceCard({
      id: service.id,
      title: service.name,
      description: service.description,
      category: service.category,
      price_range: service.price_range,
      rating: service.rating,
      custom_image: service.image_url,
      is_featured: false
    });

    return (
      <ServiceCard
        key={service.id}
        data={serviceCategoryCardData}
        variant="compact"
        onPress={(data) => handleServicePress(data)}
        onSecondaryAction={(data) => handleSaveService(data)}
        style={{ marginBottom: 16 }}
      />
    );
  };

  return (
    <GestureHandlerRootView style={styles.container}>
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
          
          <TouchableOpacity 
            style={styles.locationPill} 
            activeOpacity={0.7}
            onPress={handleLocationPress}
          >
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        disallowInterruption={false}
      >
        {searchState.query_buffer || searchState.active_filters.service_tags ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {isSearching ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#3ad3db" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.provider_id}
                renderItem={renderSearchResult}
                scrollEnabled={false}
              />
            ) : (
              <EmptyState
                {...EmptyStateConfigs.savedCleaners}
                title="No providers found"
                subtitle="Try adjusting your search or filters."
                showFeatures={false}
                actions={[]}
              />
            )}
          </View>
        ) : null}
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

        {/* Videos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'Featured' ? 'Featured Videos' : `${selectedCategory} Videos`}
          </Text>
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
                  onPress: () => navigation.navigate('MainTabs'),
                  icon: 'videocam',
                  primary: true,
                }
              ]}
            />
          ) : null}
        </View>

        {/* Special Offers Banner */}
        <View style={styles.offerSection}>
          <View style={styles.specialOfferCard}>
            <LinearGradient
              colors={['#3ad3db', '#1ca7b7']}
              style={styles.specialOfferGradient}
            >
              <View style={styles.specialOfferContent}>
                <View style={styles.offerHeaderContainer}>
                  <Text style={couponClaimed ? styles.offerBadgeClaimed : styles.offerBadge}>
                    {couponClaimed ? 'CLAIMED' : 'LIMITED TIME'}
                  </Text>
                <Text style={styles.specialOfferTitle}>25% OFF First Booking</Text>
                </View>
                <Text style={styles.specialOfferSubtitle}>
                  {couponClaimed ? 'Your discount is ready!' : 'Use code'} <Text style={styles.promoCode}>HERO25</Text> {couponClaimed ? 'will auto-apply at checkout' : 'at checkout'}
                </Text>
                <Animated.View
                  style={[
                    couponClaimed ? styles.claimOfferButtonClaimed : styles.claimOfferButton,
                    !couponClaimed && { transform: [{ scale: claimButtonScale }] }
                  ]}
                >
                <TouchableOpacity 
                    style={styles.claimOfferButtonInner}
                  onPress={handleButtonPress}
                    activeOpacity={couponClaimed ? 1 : 0.7}
                  >
                    <Text style={couponClaimed ? styles.claimOfferButtonTextClaimed : styles.claimOfferButtonText}>
                      {couponClaimed ? 'Coupon Applied' : 'Claim Offer'}
                    </Text>
                    <Text style={couponClaimed ? styles.buttonCheckmark : styles.buttonArrow}>
                      {couponClaimed ? '✓' : '→'}
                    </Text>
                </TouchableOpacity>
                </Animated.View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Bottom spacing for navigation */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      <Modal transparent visible={zipModalVisible} animationType="fade" onRequestClose={() => setZipModalVisible(false)}>
        <View style={styles.zipModalOverlay} pointerEvents={zipModalVisible ? 'auto' : 'none'}>
          <View style={styles.zipModalCard}>
            <Text style={styles.zipModalTitle}>Enter your ZIP code</Text>
            <TextInput
              style={styles.zipModalInput}
              value={zipInput}
              onChangeText={(text) => setZipInput(text.replace(/\D/g, '').slice(0, 5))}
              keyboardType="number-pad"
              placeholder="94110"
              maxLength={5}
            />
            <View style={styles.zipModalActions}>
              <TouchableOpacity
                style={styles.zipModalSecondary}
                onPress={() => setZipModalVisible(false)}
                disabled={isResolvingZip}
              >
                <Text style={styles.zipModalSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.zipModalPrimary}
                onPress={handleZipSubmit}
                disabled={isResolvingZip}
              >
                <Text style={styles.zipModalPrimaryText}>
                  {isResolvingZip ? 'Saving...' : 'Save ZIP'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Floating Navigation */}
      <FloatingNavigation navigation={navigation} currentScreen="Discover" />
    </GestureHandlerRootView>
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
  featuredVideoCard: {
    marginRight: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
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
  zipModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  zipModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
  },
  zipModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  zipModalInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  zipModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  zipModalSecondary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  zipModalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  zipModalPrimary: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#26B7C9',
  },
  zipModalPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
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
  scrollContent: {
    paddingBottom: 90,
  },
  filterSection: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 12,
  },
  categoryTab: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(0, 0, 0, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  categoryTabActive: {
    backgroundColor: '#3ad3db',
    shadowColor: 'rgba(58, 211, 219, 0.25)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.3,
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
  offerSection: {
    marginBottom: 20,
    marginTop: 12,
  },
  searchResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  searchResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  searchResultIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchResultAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  searchResultAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultAvatarText: {
    color: '#374151',
    fontWeight: '700',
    fontSize: 12,
  },
  searchResultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  searchResultRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchResultRatingText: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  searchResultMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  specialOfferCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  specialOfferGradient: {
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  specialOfferContent: {
    alignItems: 'center',
  },
  offerHeaderContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  offerBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  offerBadgeClaimed: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#1ca7b7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    shadowColor: '#1ca7b7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  specialOfferTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  specialOfferSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
    opacity: 0.95,
    fontWeight: '500',
  },
  promoCode: {
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: '#1ca7b7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  claimOfferButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  claimOfferButtonClaimed: {
    backgroundColor: '#1ca7b7',
    borderRadius: 28,
    shadowColor: '#1ca7b7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  claimOfferButtonInner: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
  },
  claimOfferButtonText: {
    color: '#3ad3db',
    fontSize: 17,
    fontWeight: '800',
    marginRight: 8,
    letterSpacing: 0.3,
  },
  claimOfferButtonTextClaimed: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginRight: 8,
    letterSpacing: 0.3,
  },
  buttonArrow: {
    color: '#3ad3db',
    fontSize: 18,
    fontWeight: '700',
  },
  buttonCheckmark: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
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
    paddingHorizontal: 16,
    gap: 12,
  },
  serviceCategoryCard: {
    width: (width - 56) / 2, // Account for container padding + gap (16px*2 + 12px gap)
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    marginBottom: 16,
  },
  serviceCategoryImageContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
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
    top: 10,
    right: 10,
  },
  serviceCategoryRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 3,
  },
  serviceCategoryRatingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  serviceCategoryContent: {
    padding: 14,
    paddingTop: 10,
    paddingBottom: 16,
  },
  serviceCategoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
    lineHeight: 20,
  },
  serviceCategoryDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 16,
    fontWeight: '500',
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  serviceCategoryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default DiscoverScreen; 