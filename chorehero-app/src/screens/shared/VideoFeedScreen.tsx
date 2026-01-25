import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Switch,
  Linking,
  Animated,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { supabase } from '../../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import components
import PlayIcon from '../../components/PlayIcon';
import { BubbleStack } from '../../components/ActionBubble';
import FloatingNavigation from '../../components/FloatingNavigation';
import { TutorialOverlay } from '../../components/TutorialOverlay';

// Import tutorial hook
import { useTutorial } from '../../hooks/useTutorial';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { contentService } from '../../services/contentService';
import { useAuth } from '../../hooks/useAuth';
import { useDeviceStabilization, getVideoFeedLayout } from '../../utils/deviceStabilization';
import StabilizedText from '../../components/StabilizedText';
import CreatorFollowPill from '../../components/CreatorFollowPill';
import BookingBubble from '../../components/BookingBubble';
import { useFeedController, FeedItem, ProviderUI } from '../../hooks/useFeedController';
import AuthModal from '../../components/AuthModal';
import { getOrCreateGuestId } from '../../utils/guestSession';
import { setPendingAuthAction, setPostAuthRoute } from '../../utils/authPendingAction';
import { send_notification } from '../../services/notificationService';

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
    fromVideoFeed?: boolean;
    videoTitle?: string;
  };
  VideoFeed: {
    source?: 'main' | 'featured' | 'cleaner' | 'global';
    cleanerId?: string;
    initialVideoId?: string;
    videos?: any[]; // Pre-loaded videos for featured section
    scrollToTop?: boolean;
  };
};

type VideoFeedScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Home'>;

interface VideoFeedScreenProps {
  navigation: VideoFeedScreenNavigationProp;
  route?: {
    params?: {
      source?: 'main' | 'featured' | 'cleaner' | 'global';
      cleanerId?: string;
      initialVideoId?: string;
      videos?: any[];
      scrollToTop?: boolean;
    };
  };
}



import { useRoleFeatures } from '../../components/RoleBasedUI';


const { width, height } = Dimensions.get('window');

// Design System Constants - Brand Consistent
const DESIGN_TOKENS = {
  // Spacing
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  // Colors
  colors: {
    brand: '#3ad3db',
    brandLight: 'rgba(58, 211, 219, 0.2)',
    white: '#FFFFFF',
    whiteAlpha95: 'rgba(255, 255, 255, 0.95)',
    text: {
      primary: '#1F2937',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
    },
    accent: {
      orange: '#FFA500',
      red: '#FF3040',
    },
    shadow: {
      color: '#000',
      opacity: 0.1,
    }
  },
  // Border Radius
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    round: 25,
    full: 50,
  },
  // Typography
  text: {
    xs: 10,
    sm: 11,
    base: 12,
    md: 14,
    lg: 16,
    xl: 18,
    xxl: 20,
  },
  // Shadows
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 6,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 8,
    },
  }
};

const BOOKING_SHEET_HEIGHT = 360;
const BOOKING_SERVICES = ['Standard Cleaning', 'Deep Cleaning', 'Move In/Out'];
const BOOKING_TIMES = ['Today 2:00 PM', 'Today 4:00 PM', 'Tomorrow 9:00 AM'];


// Simple expo-video player - more stable with Expo
const ExpoVideoPlayer: React.FC<{
  videoUrl: string;
  isActive: boolean;
  isPlaying: boolean;
  style: any;
  onTogglePlay: () => void;
  onPlaybackError?: () => void;
}> = ({ videoUrl, isActive, isPlaying, style, onTogglePlay, onPlaybackError }) => {
  const [showFallback, setShowFallback] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasSetupListeners, setHasSetupListeners] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  console.log('🎬 ExpoVideoPlayer render:', { videoUrl: videoUrl.split('/').pop(), isActive, isPlaying, isReady });

  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.muted = false;
  });

  // Setup listeners only once per video URL
  useEffect(() => {
    if (!player || hasSetupListeners) return;
    
    const statusChangeListener = (status: any) => {
      console.log('📹 Video status:', status.status, 'for:', videoUrl.split('/').pop());
      
      if (status.status === 'readyToPlay') {
        console.log('✅ Video ready to play');
        setIsReady(true);
        setShowFallback(false);
        // Get duration when video is ready
        if (status.duration) {
          setDuration(status.duration);
        }
        // Clear loading timeout since video is ready
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
      } else if (status.status === 'error') {
        console.log('❌ Video error (possibly deleted file), showing fallback');
        setShowFallback(true);
        setIsReady(false);
      } else if (status.status === 'loading') {
        console.log('🔄 Video loading...');
        setIsReady(false);
      }
    };

    const playbackStatusListener = (status: any) => {
      if (status.error) {
        console.log('❌ Playback error (file may be deleted):', status.error);
        setShowFallback(true);
        setIsReady(false);
      } else if (status.currentTime !== undefined) {
        setCurrentTime(status.currentTime);
      }
      if (status.duration !== undefined && duration === 0) {
        setDuration(status.duration);
      }
    };

    player.addListener('statusChange', statusChangeListener);
    player.addListener('playbackStatusUpdate', playbackStatusListener);
    setHasSetupListeners(true);

    return () => {
      player.removeListener('statusChange', statusChangeListener);
      player.removeListener('playbackStatusUpdate', playbackStatusListener);
    };
  }, [player, videoUrl, hasSetupListeners]);

  // Reset listeners setup when video URL changes
  useEffect(() => {
    setHasSetupListeners(false);
    setIsReady(false);
    setShowFallback(false);
    
    // Clear existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    // Set timeout to show fallback if video doesn't load within 10 seconds
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('⏰ Video loading timeout, showing fallback');
      setShowFallback(true);
      setIsReady(false);
      if (isActive) {
        onPlaybackError?.();
      }
    }, 10000);
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [videoUrl]);

  // Handle play/pause logic
  useEffect(() => {
    if (!player || !isReady || showFallback) return;
    
    if (isActive && isPlaying) {
      console.log('▶️ Playing video:', videoUrl.split('/').pop());
      player.play();
    } else {
      console.log('⏸️ Pausing video:', videoUrl.split('/').pop());
      player.pause();
    }
  }, [isActive, isPlaying, player, isReady, showFallback]);

  useEffect(() => {
    if (!player || !isReady || showFallback) return;
    if (!isActive && currentTime > 0) {
      try {
        player.pause();
        player.seekBy(-currentTime);
      } catch {
        // no-op
      }
    }
  }, [isActive, player, isReady, showFallback, currentTime]);

  // Helper function to format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle seeking
  const handleSeek = (progress: number) => {
    if (player && duration > 0) {
      const seekTime = progress * duration;
      player.seekBy(seekTime - currentTime);
    }
  };

  // Show controls when tapped
  const handleVideoTap = () => {
    console.log('🎥 Video tapped, current playing state:', isPlaying);
    setShowControls(true);
    onTogglePlay();
    
    // Hide controls after 3 seconds
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  if (showFallback) {
    return (
      <TouchableWithoutFeedback onPress={onTogglePlay}>
        <View style={style}>
          <Image 
            source={{ uri: videoUrl }} 
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
          <View style={styles.videoErrorOverlay}>
            <Ionicons name="alert-circle" size={64} color="rgba(255, 100, 100, 0.8)" />
            <Text style={styles.videoErrorText}>Video Unavailable</Text>
            <Text style={[styles.videoErrorText, { fontSize: 12, marginTop: 5 }]}>
              File may have been deleted
            </Text>
          </View>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  const shouldContain = /mixkit\.co|pexels\.com|istockphoto\.com|commondatastorage\.googleapis\.com/.test(videoUrl);

  return (
    <TouchableWithoutFeedback onPress={handleVideoTap}>
      <View style={style}>
        <VideoView
          style={StyleSheet.absoluteFillObject}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          contentFit={shouldContain ? 'contain' : 'cover'}
          nativeControls={false}
          pointerEvents="none"
        />
        
        {/* Loading indicator disabled for cleaner experience */}
        
        {/* Duration Badge - Always Visible */}
        {isReady && duration > 0 && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationBadgeText}>
              {formatTime(duration)}
            </Text>
          </View>
        )}
        
        {/* Play/Pause Overlay removed - handled by main video touch area */}

        {/* Video Controls */}
        {showControls && isReady && duration > 0 && (
          <View style={styles.videoControls}>
            {/* Progress Bar */}
            <TouchableOpacity
              style={styles.progressBarContainer}
              onPress={(event) => {
                const { locationX } = event.nativeEvent;
                const containerWidth = event.currentTarget.props.style?.width || 200;
                const progress = locationX / containerWidth;
                handleSeek(Math.max(0, Math.min(1, progress)));
              }}
              activeOpacity={1}
            >
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${(currentTime / duration) * 100}%` }
                  ]} 
                />
              </View>
              <View
                style={[
                  styles.progressThumb,
                  { left: `${Math.max(0, Math.min(100, (currentTime / duration) * 100))}%` }
                ]}
              />
            </TouchableOpacity>
            
            {/* Time Display */}
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const VideoFeedScreen = ({ navigation, route }: VideoFeedScreenProps) => {
  // Route params for different video sources
  const source = route?.params?.source || 'main';
  const cleanerIdParam = route?.params?.cleanerId;
  const initialVideoId = route?.params?.initialVideoId;
  const preloadedVideos = route?.params?.videos;
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Subscribe to deletions so removed videos disappear from the feed
  useEffect(() => {
    const filter =
      source === 'cleaner' && cleanerIdParam
        ? `user_id=eq.${cleanerIdParam}`
        : undefined;

    const channel = supabase
      .channel('content_posts_delete')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'content_posts',
          ...(filter ? { filter } : {}),
        },
        (payload: any) => {
          const deletedProviderId = payload?.old?.user_id;
          if (deletedProviderId) {
            setFeedItems(prev => prev.filter(item => item.provider_id !== deletedProviderId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [source, cleanerIdParam]);
  const {
    feedItems,
    providerUiMap,
    currentIndex,
    initialIndex,
    feedState,
    isPlaying,
    setIsPlaying,
    savedProviders,
    setSavedProviders,
    followedProviders,
    setFollowedProviders,
    setFeedData,
    setFeedItems,
    setProviderUiMap,
    setHasMore,
    setNextCursor,
    markPreFetch,
    markActive,
    enterInteractedState,
    updateInteractionState,
    onViewableIndexChange,
    resetInitialIndex,
    restoredIndexRef,
  } = useFeedController({
    sourceKey: source,
    interactionStorageKey,
    onEmitAction: ({ providerId, actionType }) => {
      console.log('📣 Feed action emitted:', { providerId, actionType });
    },
    fetchMore: async (cursor) => {
      await loadRealContent(cursor, true);
    },
  });
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [isCardVisible, setIsCardVisible] = useState(true); // Default to visible for better UX
  const [sortPreference, setSortPreference] = useState<'balanced' | 'proximity' | 'engagement' | 'price'>('balanced');
  const [useEnhancedAlgorithm, setUseEnhancedAlgorithm] = useState(false);
  const [showDescriptionCard, setShowDescriptionCard] = useState(false); // Hidden initially
  const descriptionSlideAnim = useRef(new Animated.Value(0)).current;
  const [feedTitle, setFeedTitle] = useState<string | null>(null);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [interactionStorageKey, setInteractionStorageKey] = useState<string | null>(null);
  const [globalView, setGlobalView] = useState(false);
  const [guestCity, setGuestCity] = useState<string | null>(null);
  const [guestState, setGuestState] = useState<string | null>(null);
  const [bookingSheetVisible, setBookingSheetVisible] = useState(false);
  const [bookingSheetProvider, setBookingSheetProvider] = useState<FeedItem | null>(null);
  const bookingSheetTranslate = useRef(new Animated.Value(0)).current;
  const [selectedService, setSelectedService] = useState('Standard Cleaning');
  const [selectedTime, setSelectedTime] = useState('Today 2:00 PM');
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [suppressAutoPlay, setSuppressAutoPlay] = useState(false);
  const [commentOverlayVisible, setCommentOverlayVisible] = useState(false);
  const [commentOverlayProviderId, setCommentOverlayProviderId] = useState<string | null>(null);
  const autoPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const insets = useSafeAreaInsets();
  const device = useDeviceStabilization();
  const layout = getVideoFeedLayout(device);

  const flatListRef = useRef<FlatList>(null);
  const sortButtonRef = useRef<View>(null);
  const videoFeedRef = useRef<View>(null);
  const actionBubblesRef = useRef<View>(null);
  
  const { user } = useAuth();
  const { showUploadButton, isCleaner } = useRoleFeatures();
  const handleBookingConfirmation = () => {
    if (!user?.id) {
      setAuthModalVisible(true);
      return;
    }
    const hourlyRate = bookingSheetProvider?.provider_metadata?.base_price || 0;
    navigation.navigate('BookingSummary' as any, {
      cleanerId: bookingSheetProvider?.provider_id,
      cleanerName: bookingSheetProvider?.provider_metadata?.name,
      hourlyRate,
      selectedService,
      selectedTime,
    });
    setBookingSheetVisible(false);
  };

  const navigateToDiscover = () => {
    const routes = (navigation as any)?.getState?.()?.routeNames || [];
    if (routes.includes('Discover')) {
      navigation.navigate('Discover' as any);
      return;
    }
    if (routes.includes('MainTabs')) {
      navigation.navigate('MainTabs' as any, { screen: 'Discover' });
      return;
    }
    navigation.navigate('MainTabs' as any);
  };

  const safeGoBack = () => {
    if ((navigation as any)?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs' as any);
  };

  const enterGlobalView = () => {
    setGlobalView(true);
    setFeedTitle('Global View');
  };

  const requireAuth = async (actionType: 'LIKE' | 'SAVE' | 'FOLLOW' | 'BOOK' | 'COMMENT' | 'SHARE', providerId: string) => {
    await setPostAuthRoute({ name: 'VideoFeed', params: route?.params || { source } });
    if (['LIKE', 'SAVE', 'FOLLOW', 'BOOK'].includes(actionType)) {
      await setPendingAuthAction({ type: actionType as any, providerId });
    }
    setAuthModalVisible(true);
  };

  useEffect(() => {
    let isMounted = true;
    const resolveKey = async () => {
      const key = user?.id || (await getOrCreateGuestId());
      if (isMounted) setInteractionStorageKey(key);
    };
    resolveKey();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const loadGuestLocation = async () => {
      try {
        const city = await AsyncStorage.getItem('guest_city');
        const state = await AsyncStorage.getItem('guest_state');
        setGuestCity(city);
        setGuestState(state);
      } catch {
        setGuestCity(null);
        setGuestState(null);
      }
    };
    loadGuestLocation();
  }, []);

  useEffect(() => {
    if (source !== 'main') return;
    if (!loading && feedItems.length === 0 && !globalView) {
      setGlobalView(true);
      setFeedTitle('Global View');
    }
  }, [feedItems.length, loading, source, globalView]);

  useEffect(() => {
    if (source === 'global') {
      setGlobalView(true);
      setFeedTitle('Global View');
    }
  }, [source]);

  useEffect(() => {
    Animated.timing(bookingSheetTranslate, {
      toValue: bookingSheetVisible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [bookingSheetVisible, bookingSheetTranslate]);

  const openBookingSheet = (item: FeedItem) => {
    setBookingSheetProvider(item);
    setBookingSheetVisible(true);
  };
  
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

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    if (restoredIndexRef.current) return;
    if (feedItems.length > initialIndex && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: initialIndex, animated: false });
      restoredIndexRef.current = true;
    }
  }, [feedItems.length, initialIndex]);

  useEffect(() => {
    if (!route?.params?.scrollToTop) return;
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: 0, animated: true });
      resetInitialIndex(0);
    }
    navigation.setParams?.({ scrollToTop: false } as any);
  }, [route?.params?.scrollToTop, navigation, resetInitialIndex]);

  // Trigger tutorial for video feed when component loads
  useEffect(() => {
    if (user?.id && !isTutorialActive) {
      // Delay to ensure UI has rendered
      const timer = setTimeout(() => {
        triggerTutorial({ 
          screen: 'video_feed',
          feature: 'smart_feed'
        });
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [user?.id, isTutorialActive, triggerTutorial]);



  // Handle screen focus changes to pause/resume videos
  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
        setIsPlaying(false);
      };
    }, [])
  );

  useEffect(() => {
    if (feedState === 'ACTIVE' && isScreenFocused && !isUserPaused && !suppressAutoPlay) {
      setIsPlaying(true);
    }
  }, [feedState, isScreenFocused, isUserPaused, suppressAutoPlay]);

  useEffect(() => {
    return () => {
      if (autoPlayTimeoutRef.current) {
        clearTimeout(autoPlayTimeoutRef.current);
      }
    };
  }, []);

  // Video play/pause is now handled inline to avoid duplicate function errors

  const cleanupOrphanedVideos = async () => {
    try {
      console.log('🧹 Triggering cleanup of orphaned videos...');
      const result = await contentService.cleanupOrphanedPosts();
      
      if (result.success && result.cleaned > 0) {
        console.log(`✅ Cleaned up ${result.cleaned} orphaned posts`);
        // Refresh the feed to show updated content
        await loadRealContent();
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  };



  const initializeData = async () => {
    setLoading(true);
    markPreFetch();
    console.log('🚀 VideoFeedScreen: Initializing data...');
    console.log('🚀 Source:', source);
    console.log('🚀 CleanerId:', cleanerIdParam);
    console.log('🚀 Initial Video:', initialVideoId);

    try {
      // Load videos based on source
      if (source === 'cleaner' && cleanerIdParam) {
        // Load only this cleaner's videos
        console.log('👤 Loading cleaner-specific videos...');
        setFeedTitle('Videos');
        await loadCleanerVideos(cleanerIdParam);
      } else if (source === 'featured' && preloadedVideos) {
        // Use preloaded featured videos
        console.log('⭐ Loading featured videos...');
        setFeedTitle('Featured');
        await loadFeaturedVideos(preloadedVideos);
      } else if (source === 'global') {
        console.log('🌍 Loading global feed...');
        setFeedTitle('Global View');
        await loadRealContent();
      } else {
        // Default: load main feed
        console.log('🌐 Loading main feed...');
        setFeedTitle(null);
      await loadRealContent();
      }
      
      console.log('✅ Content loading completed');
    } catch (error) {
      console.error('❌ Error loading content:', error);
      setFeedItems([]);
    } finally {
      setLoading(false);
      console.log('✅ VideoFeedScreen: Data initialization complete');
    }
  };

  const buildFeedItemsFromPosts = (posts: any[]) => {
    const items: FeedItem[] = [];
    const uiMap: Record<string, ProviderUI> = {};

    posts.forEach(post => {
      const providerId = post.user_id;
      if (!providerId) return;

      const name = post.user?.name || 'Provider';
      const rating = post.user?.cleaner_profiles?.rating_average || 0;
      const basePrice = post.user?.cleaner_profiles?.hourly_rate || 0;

      items.push({
        post_id: post.id,
        provider_id: providerId,
        video_source: post.media_url || '',
        provider_metadata: {
          name,
          rating,
          base_price: basePrice,
        },
        interaction_state: {
          is_liked: false,
          is_viewed: false,
        },
      });

      if (!uiMap[providerId]) {
        uiMap[providerId] = {
          name,
          username: post.user?.username ? `@${post.user.username}` : `@${name.toLowerCase().replace(/\s+/g, '')}`,
          avatar_url: post.user?.avatar_url || null,
          rating_average: rating,
          hourly_rate: basePrice,
          verification_status: post.user?.cleaner_profiles?.verification_status,
          service_title: post.title || 'Cleaning Service',
          description: post.description || 'Professional cleaning service.',
          estimated_duration: '2-3 hrs',
        };
      }
    });

    return { items, uiMap };
  };

  // Load videos for a specific cleaner
  const loadCleanerVideos = async (cleanerId: string) => {
    try {
      console.log('👤 Loading videos for cleaner:', cleanerId);
      
      const { data: posts, error } = await supabase
        .from('content_posts')
        .select(`
          id,
          user_id,
          title,
          description,
          media_url,
          thumbnail_url,
          status,
          like_count,
          comment_count,
          view_count,
          tags,
          created_at,
          user:users!content_posts_user_id_fkey(
            id, name, avatar_url, role,
            cleaner_profiles(
              hourly_rate, rating_average, total_jobs, bio, 
              specialties, verification_status, is_available, service_radius_km
            )
          )
        `)
        .eq('user_id', cleanerId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (posts && posts.length > 0) {
        const initialProviderId = initialVideoId
          ? posts.find((post: any) => post.id === initialVideoId)?.user_id
          : undefined;
        const { items, uiMap } = buildFeedItemsFromPosts(posts);
        setFeedItems(items);
        setProviderUiMap(uiMap);
        if (initialProviderId) {
          const startIndex = items.findIndex(item => item.provider_id === initialProviderId);
          if (startIndex >= 0) {
            resetInitialIndex(startIndex);
          }
        }
        console.log(`✅ Loaded ${items.length} cleaner videos`);
      } else {
        setFeedItems([]);
        console.log('📭 No videos found for this cleaner');
      }
    } catch (error) {
      console.error('❌ Error loading cleaner videos:', error);
      setFeedItems([]);
    }
  };

  // Load featured videos from preloaded data
  const loadFeaturedVideos = async (featuredData: any[]) => {
    try {
      console.log('⭐ Processing featured videos:', featuredData.length);
      
      // Get video IDs from featured data
      const videoIds = featuredData.map(v => v.id).filter(Boolean);
      
      if (videoIds.length === 0) {
        setFeedItems([]);
        return;
      }
      
      // Fetch full video data from database
      const { data: posts, error } = await supabase
        .from('content_posts')
        .select(`
          id,
          user_id,
          title,
          description,
          media_url,
          thumbnail_url,
          status,
          like_count,
          comment_count,
          view_count,
          tags,
          created_at,
          user:users!content_posts_user_id_fkey(
            id, name, avatar_url, role,
            cleaner_profiles(
              hourly_rate, rating_average, total_jobs, bio, 
              specialties, verification_status, is_available, service_radius_km
            )
          )
        `)
        .in('id', videoIds)
        .eq('status', 'published');

      if (error) throw error;

      if (posts && posts.length > 0) {
        const initialProviderId = initialVideoId
          ? posts.find((post: any) => post.id === initialVideoId)?.user_id
          : undefined;
        const { items, uiMap } = buildFeedItemsFromPosts(posts);
        setFeedItems(items);
        setProviderUiMap(uiMap);
        if (initialProviderId) {
          const startIndex = items.findIndex(item => item.provider_id === initialProviderId);
          if (startIndex >= 0) {
            resetInitialIndex(startIndex);
          }
        }
        console.log(`✅ Loaded ${items.length} featured videos`);
      } else {
        setFeedItems([]);
      }
    } catch (error) {
      console.error('❌ Error loading featured videos:', error);
      setFeedItems([]);
    }
  };

  const loadMockData = async () => {
    console.log('🎬 Demo data loading disabled - implement real video loading here');
    // TODO: Implement real video loading from content service
    // This should load videos from the database using contentService.getFeed()
    setFeedItems([]);
  };

  const loadRealContent = async (cursor?: string, append: boolean = false) => {
    try {
      markPreFetch();
      console.log('🌐 Loading real content from database...');

      const response = await contentService.getFeed(
        { limit: 10, cursor },
        undefined
      );

      if (response.success && response.data?.posts && response.data.posts.length > 0) {
        const { items, uiMap } = buildFeedItemsFromPosts(response.data.posts);

        setFeedData(items, uiMap, {
          append,
          nextCursor: response.data.next_cursor,
          hasMore: Boolean(response.data.has_more),
        });
        return;
      }

      if (!append) {
        setFeedItems([]);
      }
      setHasMore(false);
      markActive();
    } catch (error) {
      console.error('❌ Error loading real content:', error);
      if (!append) {
        setFeedItems([]);
      }
      markActive();
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };








  const onRefresh = async () => {
    setRefreshing(true);
    console.log('🔄 Refreshing video feed...');
    try {
        await loadRealContent();
    } catch (error) {
      console.error('❌ Error during refresh:', error);
    } finally {
    setRefreshing(false);
      console.log('✅ Video feed refresh completed');
    }
  };

  const handlePlaybackFailure = (index: number) => {
    if (index !== currentIndex) return;
    const nextIndex = Math.min(currentIndex + 1, feedItems.length - 1);
    if (nextIndex !== currentIndex && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: nextIndex, animated: true });
    }
  };

  const onViewableItemsChanged = ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      
      // Only reset if actually changing to a different video
      if (newIndex !== currentIndex) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onViewableIndexChange(newIndex);
        
        // Auto-hide description when switching videos
        if (showDescriptionCard) {
          setShowDescriptionCard(false);
          Animated.timing(descriptionSlideAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        }
        
      // Auto-resume playing when switching to a new video
        if (isScreenFocused && feedState === 'ACTIVE') {
        setIsUserPaused(false);
        setIsPlaying(true);
        }
      }
    }
  };

  // Toggle description card with animation
  const toggleDescriptionCard = () => {
    const toValue = showDescriptionCard ? 0 : 1;
    setShowDescriptionCard(!showDescriptionCard);
    
    Animated.spring(descriptionSlideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  // Local-only interactions start empty by contract

  const preventAutoResumeIfPaused = () => {
    if (isPlaying) return;
    setSuppressAutoPlay(true);
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
    }
    autoPlayTimeoutRef.current = setTimeout(() => {
      setSuppressAutoPlay(false);
    }, 500);
  };

  // Button interaction handlers
  const handleLike = async (providerId: string) => {
    if (!user?.id) {
      requireAuth('LIKE', providerId);
      return;
    }
    preventAutoResumeIfPaused();
    const current = feedItems.find(item => item.provider_id === providerId)?.interaction_state.is_liked || false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateInteractionState(providerId, { is_liked: !current });
    if (!current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (user.id !== providerId) {
        try {
          await send_notification({
            type: 'like',
            title: 'New Like! ❤️',
            message: `${user.name || 'A customer'} liked your cleaning video`,
            fromUserId: user.id,
            fromUserName: user.name || 'A customer',
            fromUserAvatar: user.avatar_url,
            toUserId: providerId,
            relatedId: providerId,
          });
        } catch (error) {
          console.log('Could not send like notification:', error);
        }
      }
    }
    enterInteractedState(providerId, 'LIKE');
  };

  const handleComment = (providerId: string) => {
    if (!user?.id) {
      requireAuth('COMMENT', providerId);
      return;
    }
    preventAutoResumeIfPaused();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCommentOverlayProviderId(providerId);
    setCommentOverlayVisible(true);
    enterInteractedState(providerId, 'COMMENT');
  };

  const handleSave = (providerId: string) => {
    if (!user?.id) {
      requireAuth('SAVE', providerId);
      return;
    }
    preventAutoResumeIfPaused();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
    enterInteractedState(providerId, 'SAVE');
  };

  const handleFollow = (providerId: string) => {
    if (!user?.id) {
      requireAuth('FOLLOW', providerId);
      return;
    }
    preventAutoResumeIfPaused();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFollowedProviders(prev => {
      const next = new Set(prev);
      if (next.has(providerId)) next.delete(providerId);
      else next.add(providerId);
      return next;
    });
    enterInteractedState(providerId, 'FOLLOW');
  };

  const handleViewRatings = async (providerId: string) => {
    preventAutoResumeIfPaused();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (user?.id && user.id !== providerId) {
      try {
        await send_notification({
          type: 'system',
          title: 'New Star! ⭐',
          message: `${user.name || 'A customer'} starred your profile`,
          fromUserId: user.id,
          fromUserName: user.name || 'A customer',
          fromUserAvatar: user.avatar_url,
          toUserId: providerId,
          relatedId: providerId,
        });
      } catch (error) {
        console.log('Could not send star notification:', error);
      }
    }
    // Navigate to cleaner's ratings and reviews
    if (providerId) {
      navigation.navigate('CleanerProfile' as any, { cleanerId: providerId, activeTab: 'reviews' });
    }
  };

  const handleShare = (providerId: string) => {
    if (!user?.id) {
      requireAuth('SHARE', providerId);
      return;
    }
    preventAutoResumeIfPaused();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    enterInteractedState(providerId, 'SHARE');
  };

  const handleBooking = (providerId: string) => {
    if (!user?.id) {
      requireAuth('BOOK', providerId);
      return;
    }
    preventAutoResumeIfPaused();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    enterInteractedState(providerId, 'BOOK');
  };


  const renderVideoItem = ({ item, index }: { item: FeedItem; index: number }) => {
    const providerUi = providerUiMap[item.provider_id];
    const isMetadataReady = Boolean(providerUi);
    const isWithinWindow = Math.abs(index - currentIndex) <= 2;
    const shouldMountPlayer = Math.abs(index - currentIndex) <= 1 && feedState === 'ACTIVE';

    if (!isWithinWindow) {
      return <View style={styles.videoContainer} />;
    }

    // Check if it's a video or image based on file extension
    const isVideo = item.video_source.includes('.mov') || 
                    item.video_source.includes('.mp4') || 
                    item.video_source.includes('.avi') ||
                    item.video_source.includes('.m3u8');
    
    return (
      <View style={styles.videoContainer}>
        {/* Fixed Aspect Video Area */}
        <View style={styles.videoArea}>
        {isVideo ? (
            <View style={styles.videoFrame}>
              {shouldMountPlayer ? (
          <ExpoVideoPlayer
                  videoUrl={item.video_source}
          isActive={index === currentIndex}
                  isPlaying={isPlaying && isScreenFocused && feedState === 'ACTIVE'}
                style={StyleSheet.absoluteFillObject}
                onTogglePlay={() => {
                  console.log('🎮 ExpoVideoPlayer onTogglePlay - current state:', isPlaying);
                  const nextPlaying = !isPlaying;
                  setIsPlaying(nextPlaying);
                  setIsUserPaused(!nextPlaying);
                  if (nextPlaying) {
                    setSuppressAutoPlay(false);
                  }
                }}
                  onPlaybackError={() => handlePlaybackFailure(index)}
              />
              ) : (
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000' }]} />
              )}
              {/* Old pause overlay removed - now handled by center touch area */}
            </View>
          ) : (
            <View style={styles.videoFrame}>
              <Image 
                source={{ uri: item.video_source }} 
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageLabel}>Demo Preview - Tap to Book</Text>
              </View>
            </View>
        )}
        </View>
        
        {/* Video Center Touch Area - Main pause/play area */}
        <TouchableOpacity 
          style={styles.videoCenterTouch}
          onPress={() => {
            console.log('🎮 Video center tap - toggling play state from:', isPlaying);
            const nextPlaying = !isPlaying;
            setIsPlaying(nextPlaying);
            setIsUserPaused(!nextPlaying);
            if (nextPlaying) {
              setSuppressAutoPlay(false);
            }
          }}
          activeOpacity={1}
        >
          {!isPlaying && (
            <View style={styles.pauseIndicator}>
              <Ionicons 
                name="play" 
                size={32} 
                color="rgba(255,255,255,0.9)" 
              />
            </View>
          )}
        </TouchableOpacity>

        {/* Play Icon - Now handled by center touch area, removed duplicate */}

        {/* Video Gradient Overlays - Strong fade to black where UI sits */}
        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.4)', 'transparent']}
          style={styles.topVideoGradient}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
          style={styles.bottomVideoGradient}
          pointerEvents="none"
        />

        {/* Unified Feed Overlay - Modern Single Interface */}
        {isMetadataReady ? (
        <View
          style={[
            styles.unifiedFeedOverlay,
            {
              paddingTop: layout.creatorPill.top,
              paddingBottom: layout.bookingSection.bottom - 1, // 29px spacing
            },
          ]}
        >
          {/* Top Section - Creator pill */}
          <CreatorFollowPill
            avatarUrl={providerUi?.avatar_url || undefined}
            username={providerUi?.username || `@${item.provider_metadata.name.toLowerCase().replace(/\s+/g, '')}`}
            serviceTitle={providerUi?.service_title || 'Cleaning Service'}
            verified={providerUi?.verification_status === 'verified'}
            isFollowing={followedProviders.has(item.provider_id)}
            onPressProfile={() => item.provider_id && navigation.navigate('CleanerProfile', { cleanerId: item.provider_id })}
            onToggleFollow={() => item.provider_id && handleFollow(item.provider_id)}
            height={layout.creatorPill.height}
            maxWidth={layout.creatorPill.maxWidth}
          />

          {/* Middle Section - Action Bubbles Integrated */}
          <Animated.View
            style={[
              styles.modernActionSection,
              {
                bottom: layout.actionRail.bottom,
                right: layout.actionRail.right,
                opacity: descriptionSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0], // Hide when description shows
                }),
                transform: [
                  {
                    translateX: descriptionSlideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 50], // Slide right and fade out
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity 
                style={styles.tikTokActionButton}
                onPress={() => handleLike(item.provider_id)}
              >
                <View style={styles.tikTokIconShadow}>
                <Ionicons 
                    name={item.interaction_state.is_liked ? "heart" : "heart-outline"} 
                    size={32} 
                    color={item.interaction_state.is_liked ? "#FF2D55" : "#FFFFFF"} 
                  />
                </View>
                <Text style={styles.tikTokActionLabel}>Like</Text>
              </TouchableOpacity>
        </View>

            <View style={styles.actionButtonContainer}>
                    <TouchableOpacity 
                style={styles.tikTokActionButton}
                onPress={() => handleViewRatings(item.provider_id)}
              >
                <View style={styles.tikTokIconShadow}>
                  <Ionicons name="star" size={32} color="#FFD700" />
                </View>
                <Text style={styles.tikTokActionLabel}>
                  {item.provider_metadata.rating ? item.provider_metadata.rating.toFixed(1) : 'New'}
                </Text>
                    </TouchableOpacity>
                </View>
                
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={styles.tikTokActionButton}
                onPress={() => handleComment(item.provider_id)}
              >
                <View style={styles.tikTokIconShadow}>
                  <Ionicons name="chatbubble-ellipses" size={30} color="#FFFFFF" />
                </View>
                <Text style={styles.tikTokActionLabel}>Comment</Text>
              </TouchableOpacity>
            </View>
                
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={styles.tikTokActionButton}
                onPress={() => handleSave(item.provider_id)}
              >
                <View style={styles.tikTokIconShadow}>
                <Ionicons
                    name={savedProviders.has(item.provider_id) ? "bookmark" : "bookmark-outline"}
                    size={30}
                    color={savedProviders.has(item.provider_id) ? "#3AD3DB" : "#FFFFFF"}
                  />
                </View>
                <Text style={styles.tikTokActionLabel}>Save</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={styles.tikTokActionButton}
                onPress={() => handleShare(item.provider_id)}
              >
                <View style={styles.tikTokIconShadow}>
                  <Ionicons name="arrow-redo" size={30} color="#FFFFFF" />
                </View>
                <Text style={styles.tikTokActionLabel}>Share</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Bottom Section - Service Info & Booking */}
          <View style={styles.modernBottomSection}>
            {/* Expandable Description Card */}
            <Animated.View style={[
              styles.slideableDescriptionCard,
              {
                transform: [{
                  translateY: descriptionSlideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  })
                }],
                opacity: descriptionSlideAnim,
              }
            ]}>
                <View style={styles.descriptionCardHandle}>
                  <View style={styles.handleBar} />
                </View>
                <View style={styles.descriptionHeader}>
                <Text style={styles.descriptionTitle} numberOfLines={2}>
                    {providerUi?.service_title || 'Cleaning Service'}
                </Text>
                  <View style={styles.durationBadge}>
                    <Ionicons name="time-outline" size={14} color="#3AD3DB" />
                    <Text style={styles.durationBadgeText}>
                      {providerUi?.estimated_duration || '2-3 hrs'}
                    </Text>
                  </View>
                </View>
                <View style={styles.descriptionDivider} />
                <Text style={styles.descriptionText} numberOfLines={4}>
                  {providerUi?.description || 'Professional cleaning service with attention to detail and customer satisfaction.'}
                </Text>
                {/* Close Button */}
                <TouchableOpacity 
                  style={styles.closeDescriptionButton}
                  onPress={toggleDescriptionCard}
                >
                  <Ionicons name="chevron-down" size={24} color={DESIGN_TOKENS.colors.text.secondary} />
                </TouchableOpacity>
            </Animated.View>

            {/* Inline Booking CTA */}
            <View style={styles.inlineBookingContainer}>
              <View>
                <Text style={styles.inlineBookingLabel}>Starting</Text>
                <Text style={styles.inlineBookingPrice}>
                  {item.provider_metadata.base_price ? `$${item.provider_metadata.base_price}/hr` : 'Contact'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.inlineBookButton}
                onPress={() => {
                  if (!user?.id) {
                    requireAuth('BOOK', item.provider_id);
                    return;
                  }
                  handleBooking(item.provider_id);
                  openBookingSheet(item);
                }}
              >
                <Text style={styles.inlineBookButtonText}>Book Now</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
        ) : (
          <View style={styles.skeletonOverlay}>
            <View style={styles.skeletonPill} />
            <View style={styles.skeletonActions} />
            <View style={styles.skeletonBooking} />
          </View>
        )}
      </View>
    );
  };

  // Subtle pulse animation for CTA (matches customer feel)
  const ctaPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(ctaPulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      // @ts-ignore - stop exists at runtime
      loop.stop && loop.stop();
    };
  }, []);

  const pulseScale = ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const pulseOpacity = ctaPulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0] });

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Loading cleaners...</Text>
      </View>
    );
  }

  const filteredVideos = feedItems;

  // FIX: Remove stray comment, fix JSX structure, and correct indentation
  return (
      <View ref={videoFeedRef} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" translucent />
      
      {/* Back Button for non-main sources */}
      {source !== 'main' && (
        <>
          <View style={styles.sourceHeader}>
            <TouchableOpacity
              style={styles.sourceBackButton}
              onPress={safeGoBack}
            >
              <BlurView intensity={80} tint="dark" style={styles.sourceBackBlur}>
                <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
              </BlurView>
            </TouchableOpacity>
          </View>
          {feedTitle && (
            <View style={styles.sourceTitleContainer}>
              <BlurView intensity={80} tint="dark" style={styles.sourceTitleBlur}>
                <Text style={styles.sourceTitleText}>{feedTitle}</Text>
              </BlurView>
            </View>
          )}
        </>
      )}

      {globalView && filteredVideos.length > 0 && (
        <View style={[styles.globalBanner, { top: insets.top + 12 }]}>
          <Text style={styles.globalBannerText}>
            {`We haven't launched in ${guestCity ? `${guestCity}${guestState ? `, ${guestState}` : ''}` : 'your area'} yet. Browse our top pros from other areas!`}
          </Text>
        </View>
      )}
      
      {filteredVideos.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <LinearGradient
            colors={['#0891b2', '#06b6d4']}
            style={styles.emptyStateGradient}
          >
            <View style={styles.emptyStateIconContainer}>
              <LinearGradient colors={['#F59E0B', '#F59E0B']} style={styles.emptyStateIconGradient}>
                <Ionicons name="videocam-outline" size={64} color="#ffffff" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyStateTitle}>Meet our Top Heroes nationwide!</Text>
            <Text style={styles.emptyStateSubtitle}>
              Cleaners in your area will share their work here. Check back soon for amazing transformations!
            </Text>
            {true && (
               <View style={styles.emptyStateFeatures}>
                 <View style={styles.featureItem}>
                   <Ionicons name="location" size={20} color="#ffffff" />
                   <Text style={styles.featureText}>Local cleaners near you</Text>
                 </View>
                 <View style={styles.featureItem}>
                   <Ionicons name="play" size={20} color="#ffffff" />
                   <Text style={styles.featureText}>Real work showcase</Text>
                 </View>
                 <View style={styles.featureItem}>
                   <Ionicons name="heart" size={20} color="#ffffff" />
                   <Text style={styles.featureText}>Book directly from videos</Text>
                 </View>
               </View>
             )}
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => {
                enterGlobalView();
                loadRealContent();
              }}
            >
              <Text style={styles.exploreButtonText}>Explore Cleaners</Text>
              <Ionicons name="arrow-forward" size={20} color="#0891b2" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredVideos}
          renderItem={renderVideoItem}
          keyExtractor={(item, index) => item.post_id || `${item.provider_id}-${index}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={onRefresh}
          scrollEnabled={feedState !== 'INTERACTED'}
          initialScrollIndex={filteredVideos.length > 0 ? Math.min(initialIndex, filteredVideos.length - 1) : 0}
          onScrollToIndexFailed={() => {}}
          getItemLayout={(data, index) => ({
            length: height,
            offset: height * index,
            index,
          })}
        />
      )}
      
      {/* Floating Navigation - Show appropriate navigation based on effective role */}
      {isCleaner ? (
        <CleanerFloatingNavigation navigation={navigation as any} currentScreen="Content" />
      ) : (
        <FloatingNavigation
          navigation={navigation as any}
          currentScreen="Content"
          variant="transparent"
          blurIntensity={0}
        />
      )}
      
      {/* Tutorial Overlay */}
      {isTutorialActive && currentTutorial && user?.id && (
        <TutorialOverlay
          tutorial={currentTutorial}
          currentStepIndex={currentStepIndex}
          onStepComplete={nextStep}
          onTutorialComplete={completeTutorial}
          onTutorialSkip={skipTutorial}
          targetElementRef={
            currentTutorial.steps[currentStepIndex]?.targetElement === 'sort_button' ? sortButtonRef :
            currentTutorial.steps[currentStepIndex]?.targetElement === 'action_bubbles' ? actionBubblesRef :
            currentTutorial.steps[currentStepIndex]?.targetElement === 'video_feed' ? videoFeedRef :
            undefined
          }
          userId={user.id}
        />
      )}
      <Modal transparent visible={bookingSheetVisible} animationType="none" onRequestClose={() => setBookingSheetVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <TouchableWithoutFeedback onPress={() => setBookingSheetVisible(false)}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                transform: [
                  {
                    translateY: bookingSheetTranslate.interpolate({
                      inputRange: [0, 1],
                      outputRange: [BOOKING_SHEET_HEIGHT, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>
              {`Schedule with ${bookingSheetProvider?.provider_metadata.name || 'Pro'}`}
            </Text>
            <Text style={styles.sheetSubtitle}>Pick a service and time</Text>

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Service</Text>
              <View style={styles.sheetOptionsRow}>
                {BOOKING_SERVICES.map(service => (
                  <TouchableOpacity
                    key={service}
                    style={[
                      styles.sheetOptionChip,
                      selectedService === service && styles.sheetOptionChipActive,
                    ]}
                    onPress={() => setSelectedService(service)}
                  >
                    <Text
                      style={[
                        styles.sheetOptionText,
                        selectedService === service && styles.sheetOptionTextActive,
                      ]}
                    >
                      {service}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.sheetSection}>
              <Text style={styles.sheetSectionTitle}>Availability</Text>
              <View style={styles.sheetOptionsRow}>
                {BOOKING_TIMES.map(time => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.sheetOptionChip,
                      selectedTime === time && styles.sheetOptionChipActive,
                    ]}
                    onPress={() => setSelectedTime(time)}
                  >
                    <Text
                      style={[
                        styles.sheetOptionText,
                        selectedTime === time && styles.sheetOptionTextActive,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.sheetPrimaryButton}
              onPress={handleBookingConfirmation}
            >
              <Text style={styles.sheetPrimaryButtonText}>Confirm</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      <Modal
        transparent
        visible={commentOverlayVisible}
        animationType="fade"
        onRequestClose={() => setCommentOverlayVisible(false)}
      >
        <View style={styles.commentOverlayBackdrop} pointerEvents="box-none">
          <View
            style={[
              styles.commentOverlayCard,
              { marginTop: layout.creatorPill.top + layout.creatorPill.height + 12 },
            ]}
          >
            <View style={styles.commentOverlayHeader}>
              <Text style={styles.commentOverlayTitle}>Comments</Text>
              <TouchableOpacity
                onPress={() => setCommentOverlayVisible(false)}
                accessibilityLabel="Close comments"
              >
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.commentOverlaySubtitle}>
              {commentOverlayProviderId
                ? `Say something nice to ${providerUiMap[commentOverlayProviderId]?.name || 'this pro'}.`
                : 'Say something nice to this pro.'}
            </Text>
            <View style={styles.commentOverlayHint}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
              <Text style={styles.commentOverlayHintText}>Quick comments coming soon.</Text>
            </View>
          </View>
        </View>
      </Modal>
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onOpenEmail={() => {
          setAuthModalVisible(false);
          navigation.navigate('AuthScreen');
        }}
      />
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 0,
    margin: 0,
  },
  // Source-specific header styles
  sourceHeader: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sourceBackBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  sourceTitleContainer: {
    position: 'absolute',
    top: 50,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 99,
  },
  sourceTitleBlur: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sourceTitleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 16,
  },
  videoContainer: {
    width,
    height,
    position: 'relative',
    backgroundColor: '#000',
  },
  // Letterboxed video area with safe top/bottom
  videoArea: {
    position: 'absolute',
    top: 0,
    bottom: 0, // Fill entire container
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000', // Ensure black background
  },
  videoFrame: {
    width: '100%', // Full width
    height: '100%', // Full height
    backgroundColor: '#000',
    // Removed border radius and shadow for full screen video
  },
  videoPauseOverlay: {
    position: 'absolute',
    top: '15%', // Start below creator pill area
    left: 0,
    right: 0,
    bottom: '25%', // End above booking section area
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 5, // Lower z-index, just above video
  },
  pauseIndicator: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topVideoGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150, // Larger area for better fade
    zIndex: 3, // Above video, below UI
  },
  bottomVideoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 280, // Much larger area to cover booking + nav + padding
    zIndex: 3, // Above video, below UI
  },
  videoCenterTouch: {
    position: 'absolute',
    top: '25%', // Below creator pill with more space
    left: '20%', // Centered positioning
    right: '20%', // Equal spacing from both sides
    bottom: '35%', // More space above booking section
    backgroundColor: 'transparent',
    zIndex: 150, // Highest z-index to ensure touch works
    alignItems: 'center', // Center the play button horizontally
    justifyContent: 'center', // Center the play button vertically
  },
  directVideoTouch: {
    position: 'absolute',
    top: height * 0.08,
    left: 0,
    right: 0,
    bottom: height * 0.22,
    zIndex: 1, // Very low z-index, just above video
    backgroundColor: 'transparent',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  videoTouchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 100, // Above video but below other UI elements
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  
  // Header styles
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 30,
  },
  topSearchButton: {
    marginTop: 20,
  },
  topSearchButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#14B8A6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Social buttons styles
  socialButtonsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 140,
    alignItems: 'center',
    gap: 16,
    zIndex: 20,
  },
  socialButton: {
    alignItems: 'center',
    gap: 8,
  },
  socialButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // Remove circular background
    borderWidth: 0, // Remove border
  },
  socialButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Cleaner Profile Header
  cleanerProfileHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 35, // Increased to be higher than headerControls (zIndex: 30)
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Clean white background
    minWidth: 220, // Ensure adequate touch area
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  cleanerProfileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#3ad3db',
  },
  cleanerProfileInfo: {
    flex: 1,
    minWidth: 120,
  },
  cleanerProfileUsername: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    maxWidth: 200,
  },
  cleanerProfileBio: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    maxWidth: 220,
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
  globalBanner: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    zIndex: 30,
  },
  globalBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    marginLeft: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  exploreButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0891b2',
    marginRight: 8,
  },

  // Enhanced service card styles with white glass effect to match nav
  serviceCardWrapper: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 80,
    zIndex: 20,
  },
  serviceCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1.5,
    borderColor: 'rgba(58, 211, 219, 0.3)',
    overflow: 'hidden',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 15,
    width: '75%',
    marginLeft: 20,
  },
  serviceCardContent: {
    padding: 12,
    backgroundColor: 'transparent',
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  serviceHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceTitle: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  servicePrice: {
    color: '#dc9a00',
    fontSize: 18,
    fontWeight: '700',
  },
  serviceDetails: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
  bookButton: {
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    width: '100%',
  },
  bookButtonGradient: {
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bookButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },



  // Sort Controls
  sortControls: {
    position: 'absolute',
    bottom: 150,
    right: 20,
    zIndex: 25,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sortButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Card Toggle Button
  cardToggleButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    zIndex: 25,
    padding: 8,
  },
  headerControls: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 30,
  },
  demoToggleCenter: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 30,
  },

  searchButtonTopRight: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoToggleLabel: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  debugInfo: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  debugText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '500',
  },
  imageOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  imageLabel: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  videoErrorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoErrorText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  videoErrorSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoLoadingText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Right Side Actions - Classic TikTok Style
  rightSideActions: {
    position: 'absolute',
    right: 16,
    bottom: 150, // Moved up from 200 to 150
    zIndex: 15,
    alignItems: 'center',
  },
  
  // Modern Service Card Styles
  // Enhanced Service Card Styles
  enhancedServiceCardWrapper: {
    position: 'absolute',
    bottom: 110,
    left: 16,
    right: 80,
    zIndex: 10,
  },
  enhancedServiceCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  enhancedServiceContent: {
    padding: 16,
  },
  enhancedServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  enhancedServiceInfo: {
    flex: 1,
  },
  enhancedServiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  enhancedQuickStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enhancedStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enhancedStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
    marginHorizontal: 8,
  },
  enhancedStatText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 3,
  },
  enhancedPriceText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3ad3db',
  },
  enhancedCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  enhancedSaveButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enhancedCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  enhancedActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  enhancedActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enhancedViewProfileButton: {
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.2)',
  },
  enhancedViewProfileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  enhancedBookButton: {
    overflow: 'hidden',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  enhancedBookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  enhancedBookButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  // Enhanced Cleaner Profile Header Styles
  enhancedCleanerProfileHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 15,
    maxWidth: width * 0.65,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  enhancedAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  enhancedCleanerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  enhancedVerificationBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#3ad3db',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  enhancedCleanerInfo: {
    flex: 1,
  },
  enhancedNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  enhancedCleanerUsername: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginRight: 6,
  },
  enhancedOnlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  enhancedCleanerBio: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 11,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Enhanced Loading Styles
  enhancedLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  loadingShimmer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  enhancedLoadingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  
  // Video Controls Styles
  videoControls: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    padding: 12,
  },
  progressBarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3ad3db',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    backgroundColor: '#3ad3db',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: -8,
  },
  timeContainer: {
    alignItems: 'center',
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Duration Badge Styles
  durationBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  durationBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Unified Feed Overlay - Standardized Grid System
  unifiedFeedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingTop: DESIGN_TOKENS.spacing.lg + 44, // StatusBar + margin = 60px
    paddingBottom: 110 + 9, // FloatingNav (110px) + 9px desired gap
    paddingHorizontal: 20, // 20px sides - EXACT match with FloatingNavigation
    zIndex: 10, // Higher than videoTapOverlay (5)
  },
  skeletonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 100,
    paddingBottom: 160,
    zIndex: 10,
  },
  skeletonPill: {
    width: 260,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  skeletonActions: {
    width: 52,
    height: 220,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.18)',
    position: 'absolute',
    right: 24,
    top: '30%',
  },
  skeletonBooking: {
    width: '85%',
    height: 64,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  inlineBookingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    marginLeft: 0,
    alignSelf: 'flex-start',
  },
  inlineBookingLabel: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineBookingPrice: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  inlineBookButton: {
    backgroundColor: '#26B7C9',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  inlineBookButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetContainer: {
    height: BOOKING_SHEET_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 16,
  },
  sheetSection: {
    marginBottom: 16,
  },
  sheetSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  sheetOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetOptionChip: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sheetOptionChipActive: {
    backgroundColor: '#26B7C9',
    borderColor: '#26B7C9',
  },
  sheetOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  sheetOptionTextActive: {
    color: '#FFFFFF',
  },
  sheetPrimaryButton: {
    marginTop: 8,
    backgroundColor: '#26B7C9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  commentOverlayBackdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
  },
  commentOverlayCard: {
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  commentOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  commentOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  commentOverlaySubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
  commentOverlayHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  commentOverlayHintText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
  },

  // Modern Cleaner Header - Thinner with reduced whitespace
  modernCleanerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DESIGN_TOKENS.colors.whiteAlpha95,
    borderRadius: DESIGN_TOKENS.radius.round,
    paddingHorizontal: DESIGN_TOKENS.spacing.md, // Reduced from lg
    paddingVertical: DESIGN_TOKENS.spacing.sm, // Reduced from md
    height: 52, // Reduced from 64 for thinner look
    ...DESIGN_TOKENS.shadow.lg,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.brandLight,
    alignSelf: 'flex-start', // Prevent full width stretch
    maxWidth: width - 140, // Leave room for smart button (width - smart button width - margins)
    minWidth: 280, // Minimum width to prevent cramping
  },
  modernAvatarContainer: {
    position: 'relative',
    marginRight: DESIGN_TOKENS.spacing.md,
    width: 40, // Fixed container width
    height: 40, // Fixed container height
  },
  modernCleanerAvatar: {
    width: 40,
    height: 40,
    borderRadius: DESIGN_TOKENS.radius.xl,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.brand,
  },
  modernVerificationBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: DESIGN_TOKENS.radius.sm,
    backgroundColor: DESIGN_TOKENS.colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.white,
  },
  modernCleanerInfo: {
    flex: 1,
    minWidth: 0, // Allow text to truncate properly
  },
  modernCleanerUsername: {
    color: DESIGN_TOKENS.colors.text.primary,
    fontSize: DESIGN_TOKENS.text.lg,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modernCleanerService: {
    color: DESIGN_TOKENS.colors.text.secondary,
    fontSize: DESIGN_TOKENS.text.base,
    fontWeight: '500',
    marginTop: DESIGN_TOKENS.spacing.xs,
  },
  viewProfileLink: {
    marginTop: 2,
  },
  viewProfileText: {
    fontSize: DESIGN_TOKENS.text.base,
    color: DESIGN_TOKENS.colors.brand,
    fontWeight: '600',
  },
  modernFollowButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    height: 36,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.brand,
    // remove shadow to sit naturally within the creator pill
    shadowColor: 'transparent',
    flexShrink: 0,
    alignSelf: 'center', // Fix vertical alignment in creator pill
    marginTop: 1, // subtle nudge to visually center tall glyphs
  },
  modernFollowText: {
    color: DESIGN_TOKENS.colors.brand,
    fontSize: 13,
    fontWeight: '600',
  },
  modernFollowButtonActive: {
    backgroundColor: DESIGN_TOKENS.colors.brand,
  },
  modernFollowTextActive: {
    color: DESIGN_TOKENS.colors.white,
  },

  // Modern Action Section - TikTok style action rail
  modernActionSection: {
    position: 'absolute',
    // Position is provided dynamically via getVideoFeedLayout(device)
    alignItems: 'center',
    gap: 4, // Tight spacing like TikTok
    zIndex: 15, // Higher than unifiedFeedOverlay (10) and videoTapOverlay (5)
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: 0,
  },
  modernActionBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40, // Will be overridden by device-specific sizing
    height: 40, // Will be overridden by device-specific sizing
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // More opaque
    borderRadius: 20,
    ...DESIGN_TOKENS.shadow.lg, // Match booking/nav shadow strength
    borderWidth: 2, // Match booking/nav border thickness
    borderColor: DESIGN_TOKENS.colors.brandLight, // Match booking/nav border color
  },
  // TikTok-style action buttons - clean icons with shadows
  tikTokActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    minWidth: 48,
  },
  tikTokIconShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 8,
  },
  tikTokActionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernActionText: {
    color: DESIGN_TOKENS.colors.text.primary,
    fontSize: DESIGN_TOKENS.text.base, // 12px
    fontWeight: '700',
    marginTop: 4, // Reduced spacing to compensate for larger font
    marginBottom: 0, // Minimal space below text
    textAlign: 'center',
    width: 44, // Match updated bubble width
  },

  // Modern Bottom Section - Fixed Spacing & Dimensions
  modernBottomSection: {
    gap: 12, // Increased gap to match bottom spacing
    // Remove margin extension to match nav tab exactly
  },
  modernServiceInfo: {
    backgroundColor: DESIGN_TOKENS.colors.whiteAlpha95,
    borderRadius: DESIGN_TOKENS.radius.xl, // 20px
    padding: DESIGN_TOKENS.spacing.lg, // 16px
    ...DESIGN_TOKENS.shadow.lg,
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.brandLight,
    minHeight: 120, // Fixed minimum height for consistency
    // Remove width override - let it match container width
  },
  modernServiceTitle: {
    color: DESIGN_TOKENS.colors.text.primary,
    fontSize: DESIGN_TOKENS.text.xl, // 18px
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: DESIGN_TOKENS.spacing.sm, // 8px
    numberOfLines: 2, // Consistent line limiting
  },
  modernServiceDescription: {
    color: DESIGN_TOKENS.colors.text.secondary,
    fontSize: DESIGN_TOKENS.text.md, // 14px
    fontWeight: '500',
    lineHeight: 20, // adjust for new size
    marginBottom: DESIGN_TOKENS.spacing.md, // 12px
    numberOfLines: 2, // Consistent line limiting
  },
  modernStatsRow: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.lg, // 16px
    flexWrap: 'wrap', // Allow wrapping if needed
  },
  modernStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs, // 4px
    minWidth: 60, // Prevent cramping
  },
  modernStatText: {
    color: DESIGN_TOKENS.colors.text.secondary,
    fontSize: DESIGN_TOKENS.text.base, // 12px
    fontWeight: '600',
  },

  // Modern Booking Section - Fixed Layout & Dimensions
  modernBookingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.98)', // More opaque for better contrast
    borderRadius: DESIGN_TOKENS.radius.xl,
    paddingVertical: DESIGN_TOKENS.spacing.sm, // 8px top/bottom to center 44px button in 60px height
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingRight: DESIGN_TOKENS.spacing.sm, // tighten right edge to fit combined control
    gap: DESIGN_TOKENS.spacing.sm, // small consistent spacing between content-sized blocks
    ...DESIGN_TOKENS.shadow.lg,
    borderWidth: 2,
    borderColor: DESIGN_TOKENS.colors.brandLight,
    height: 60, // Slightly reduced height
    marginHorizontal: 2, // Small margin for visual breathing room
  },
  modernPriceContainer: {
    // content-sized block to avoid excess spacing
    flexGrow: 0,
    flexShrink: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: DESIGN_TOKENS.spacing.sm,
    // remove minWidth to restore previous layout on larger devices
  },
  modernPriceLabel: {
    color: DESIGN_TOKENS.colors.text.tertiary, // slightly lighter tone
    fontSize: DESIGN_TOKENS.text.base, // 12px
    fontWeight: '500',
    marginBottom: 2, // pull closer to price
  },
  modernPriceValue: {
    color: DESIGN_TOKENS.colors.text.primary,
    fontSize: DESIGN_TOKENS.text.xxl, // 20px
    fontWeight: '800',
    letterSpacing: -0.7, // slightly tighter for premium feel
  },
  modernBookButton: {
    flex: 1.3, // Slightly larger button
    borderRadius: DESIGN_TOKENS.radius.lg, // 16px
    overflow: 'hidden',
    height: 48, // Fixed button height
    minWidth: 120, // Ensure minimum width for text
    ...DESIGN_TOKENS.shadow.md,
  },
  modernBookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.md, // 12px
    paddingHorizontal: DESIGN_TOKENS.spacing.lg, // 16px
    gap: DESIGN_TOKENS.spacing.sm, // 8px
    height: 48, // Fixed height
    flex: 1, // Fill available space
  },
  modernBookButtonText: {
    color: DESIGN_TOKENS.colors.white,
    fontSize: DESIGN_TOKENS.text.lg, // 16px
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Fixed Book Button - Avoiding LinearGradient text issues
  modernBookButtonFixed: {
    borderRadius: DESIGN_TOKENS.radius.lg, // 16px
    height: 44, // Slightly smaller to better fit container
    minWidth: 136, // increased width
    maxWidth: 176, // maintain headroom
    backgroundColor: DESIGN_TOKENS.colors.brand, // Solid color using hero orange
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.md, // Tighter padding (12px)
    gap: DESIGN_TOKENS.spacing.sm, // 8px
    ...DESIGN_TOKENS.shadow.md,
    // Subtle gradient effect using shadow
    shadowColor: 'rgba(245, 158, 11, 0.6)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  modernBookButtonTextFixed: {
    color: '#FFFFFF', // Explicit white color
    fontSize: 16, // Explicit font size
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
    fontFamily: 'System', // Use system font explicitly
    includeFontPadding: false, // Android: remove extra padding
    textAlignVertical: 'center', // Android: center vertically
  },

  // Modern Smart Button - Fixed Positioning System
  modernSmartButton: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.lg + 64 + DESIGN_TOKENS.spacing.sm, // Header + spacing = 88px
    right: DESIGN_TOKENS.spacing.lg, // Fixed 16px margin
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DESIGN_TOKENS.colors.whiteAlpha95,
    paddingHorizontal: DESIGN_TOKENS.spacing.md, // 12px
    paddingVertical: DESIGN_TOKENS.spacing.sm, // 8px
    borderRadius: DESIGN_TOKENS.radius.xl, // 20px
    ...DESIGN_TOKENS.shadow.md,
    borderWidth: 1,
    borderColor: 'rgba(229, 231, 235, 1)',
    gap: DESIGN_TOKENS.spacing.xs, // 4px
    height: 32, // Fixed height
    width: 80, // Fixed width instead of minWidth
    justifyContent: 'center', // Center content
  },
  modernSmartText: {
    color: DESIGN_TOKENS.colors.text.primary,
    fontSize: DESIGN_TOKENS.text.sm, // 11px
    fontWeight: '600',
  },

  // Slideable Description Card Styles - Refined visual treatment
  slideableDescriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 211, 219, 0.25)',
    minHeight: 110,
    maxHeight: 180,
    marginHorizontal: 0, // Match booking bubble alignment
    alignSelf: 'stretch', // Full width within container
  },
  descriptionGradient: {
    borderRadius: DESIGN_TOKENS.radius.lg,
    padding: DESIGN_TOKENS.spacing.md,
    flex: 1,
  },
  descriptionCardHandle: {
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.xs, // Further reduced to xs for minimal whitespace
  },
  handleBar: {
    width: 48,
    height: 5,
    backgroundColor: 'rgba(58, 211, 219, 0.35)',
    borderRadius: 3,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  descriptionTitle: {
    flex: 1,
    color: DESIGN_TOKENS.colors.text.primary,
    fontSize: DESIGN_TOKENS.text.xl,
    fontWeight: '700',
    lineHeight: 22,
    marginRight: 10,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(58, 211, 219, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  durationBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3AD3DB',
  },
  descriptionDivider: {
    height: 1,
    backgroundColor: 'rgba(58, 211, 219, 0.22)',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  descriptionText: {
    color: DESIGN_TOKENS.colors.text.secondary,
    fontSize: DESIGN_TOKENS.text.md, // bump to 14px for better readability
    fontWeight: '500',
    lineHeight: 20, // adjust for new size
    marginBottom: 0, // Remove bottom margin to reduce whitespace
  },
  uniqueStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.sm,
    backgroundColor: 'rgba(247, 250, 252, 0.8)',
    borderRadius: DESIGN_TOKENS.radius.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  uniqueStatBlock: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  uniqueStatLabel: {
    color: DESIGN_TOKENS.colors.text.tertiary,
    fontSize: DESIGN_TOKENS.text.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  uniqueStatValue: {
    color: DESIGN_TOKENS.colors.text.primary,
    fontSize: DESIGN_TOKENS.text.sm, // Slightly smaller than before
    fontWeight: '600',
    textAlign: 'center',
  },
  closeDescriptionButton: {
    alignSelf: 'center',
    padding: DESIGN_TOKENS.spacing.xs, // Reduced padding
    marginTop: 0, // Remove top margin
  },
  centeredStatsContainer: {
    alignItems: 'flex-start', // left align to remove empty space on the left
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    flexGrow: 0,
    flexShrink: 1,
    marginLeft: DESIGN_TOKENS.spacing.xs,
  },
  centeredStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs, // Small gap between icon and text
  },
  centeredStatText: {
    fontSize: DESIGN_TOKENS.text.sm, // Back to original 12px
    fontWeight: '600',
    color: DESIGN_TOKENS.colors.text.secondary,
  },
  infoButtonSection: {
    flex: 1, // Equal space - third section
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonSection: {
    // push to the right edge while prior blocks are content-sized
    marginLeft: 'auto',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  descriptionToggleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: DESIGN_TOKENS.colors.whiteAlpha95,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.brandLight,
    ...DESIGN_TOKENS.shadow.sm,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 4,
  },
  reviewCountText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 2,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 4,
  },
  modernBookButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: 'rgba(245, 158, 11, 0.6)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 100,
    position: 'relative',
  },
  modernBookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modernBookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  
  // Social Actions Styles
  socialActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(107, 114, 128, 0.05)',
    borderRadius: 12,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  socialButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
  likedText: {
    color: '#EF4444',
  },
  infoAndBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  descriptionToggleButtonConnected: {
    width: 40, // match smaller social buttons
    height: 40, // match smaller social buttons
    borderRadius: 20,
    backgroundColor: DESIGN_TOKENS.colors.whiteAlpha95,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DESIGN_TOKENS.colors.brandLight,
    marginRight: 8, // spacing from Book Now
    ...DESIGN_TOKENS.shadow.sm, // subtle shadow behind the pill
  },
});

export default VideoFeedScreen; 