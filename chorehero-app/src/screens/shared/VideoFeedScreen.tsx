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

// Import components
import PlayIcon from '../../components/PlayIcon';
import { BubbleStack } from '../../components/ActionBubble';
import FloatingNavigation from '../../components/FloatingNavigation';
import { TutorialOverlay } from '../../components/TutorialOverlay';

// Import tutorial hook
import { useTutorial } from '../../hooks/useTutorial';
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { useLocationContext } from '../../context/LocationContext';
import { notificationService } from '../../services/notificationService';
import { contentService } from '../../services/contentService';
import { useAuth } from '../../hooks/useAuth';
import { locationService } from '../../services/location';
import { guestModeService } from '../../services/guestModeService';
import { useDeviceStabilization, getVideoFeedLayout } from '../../utils/deviceStabilization';
import StabilizedText from '../../components/StabilizedText';
import CreatorFollowPill from '../../components/CreatorFollowPill';
import BookingBubble from '../../components/BookingBubble';

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
    source?: 'main' | 'featured' | 'cleaner';
    cleanerId?: string;
    initialVideoId?: string;
    videos?: any[]; // Pre-loaded videos for featured section
  };
};

type VideoFeedScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Home'>;

interface VideoFeedScreenProps {
  navigation: VideoFeedScreenNavigationProp;
  route?: {
    params?: {
      source?: 'main' | 'featured' | 'cleaner';
      cleanerId?: string;
      initialVideoId?: string;
      videos?: any[];
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

interface CleanerProfile {
  user_id: string;
  video_profile_url: string | null;
  rating_average: number;
  total_jobs: number;
  hourly_rate: number;
  bio: string | null;
  specialties: string[] | null;
  name: string;
  avatar_url: string | null;
  username: string;
  service_title: string;
  estimated_duration: string;
  latitude?: number;
  longitude?: number;
  verification_status?: 'verified' | 'pending' | 'rejected';
}

interface VideoItem {
  id: string;
  cleaner: CleanerProfile;
  video_url: string;
  title: string;
  description: string;
  liked: boolean;
  saved: boolean;
  likes: number;
  comments: number;
  shares: number;
  hashtags: string[];
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

// Simple expo-video player - more stable with Expo
const ExpoVideoPlayer: React.FC<{
  videoUrl: string;
  isActive: boolean;
  isPlaying: boolean;
  style: any;
  onTogglePlay: () => void;
}> = ({ videoUrl, isActive, isPlaying, style, onTogglePlay }) => {
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

  return (
    <TouchableWithoutFeedback onPress={handleVideoTap}>
      <View style={style}>
        <VideoView
          style={StyleSheet.absoluteFillObject}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          contentFit="cover"
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
  
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [isCardVisible, setIsCardVisible] = useState(true); // Default to visible for better UX
  const [sortPreference, setSortPreference] = useState<'balanced' | 'proximity' | 'engagement' | 'price'>('balanced');
  const [useEnhancedAlgorithm, setUseEnhancedAlgorithm] = useState(false);
  const [showDescriptionCard, setShowDescriptionCard] = useState(false); // Hidden initially
  const descriptionSlideAnim = useRef(new Animated.Value(0)).current;
  const [likedVideos, setLikedVideos] = useState<Set<string>>(new Set());
  const [savedVideos, setSavedVideos] = useState<Set<string>>(new Set());
  const [followedCleaners, setFollowedCleaners] = useState<Set<string>>(new Set());
  const [feedTitle, setFeedTitle] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const device = useDeviceStabilization();
  const layout = getVideoFeedLayout(device);

  const flatListRef = useRef<FlatList>(null);
  const sortButtonRef = useRef<View>(null);
  const videoFeedRef = useRef<View>(null);
  const actionBubblesRef = useRef<View>(null);
  
  const { location } = useLocationContext();
  const { user } = useAuth();
  const { showUploadButton, isCleaner } = useRoleFeatures();
  
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
      } else {
        // Default: load main feed
        console.log('🌐 Loading main feed...');
        setFeedTitle(null);
        await loadRealContent();
      }
      
      console.log('✅ Content loading completed');
    } catch (error) {
      console.error('❌ Error loading content:', error);
      setVideos([]);
    } finally {
      setLoading(false);
      console.log('✅ VideoFeedScreen: Data initialization complete');
    }
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
        const transformedVideos = transformPosts(posts);
        
        // If initialVideoId is specified, reorder so it's first
        if (initialVideoId) {
          const initialIndex = transformedVideos.findIndex(v => v.id === initialVideoId);
          if (initialIndex > 0) {
            const [initialVideo] = transformedVideos.splice(initialIndex, 1);
            transformedVideos.unshift(initialVideo);
          }
        }
        
        setVideos(transformedVideos);
        console.log(`✅ Loaded ${transformedVideos.length} cleaner videos`);
      } else {
        setVideos([]);
        console.log('📭 No videos found for this cleaner');
      }
    } catch (error) {
      console.error('❌ Error loading cleaner videos:', error);
      setVideos([]);
    }
  };

  // Load featured videos from preloaded data
  const loadFeaturedVideos = async (featuredData: any[]) => {
    try {
      console.log('⭐ Processing featured videos:', featuredData.length);
      
      // Get video IDs from featured data
      const videoIds = featuredData.map(v => v.id).filter(Boolean);
      
      if (videoIds.length === 0) {
        setVideos([]);
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
        const transformedVideos = transformPosts(posts);
        
        // Maintain original order from featured data
        const orderedVideos = videoIds
          .map(id => transformedVideos.find(v => v.id === id))
          .filter(Boolean) as VideoItem[];
        
        // If initialVideoId is specified, reorder so it's first
        if (initialVideoId) {
          const initialIndex = orderedVideos.findIndex(v => v.id === initialVideoId);
          if (initialIndex > 0) {
            const [initialVideo] = orderedVideos.splice(initialIndex, 1);
            orderedVideos.unshift(initialVideo);
          }
        }
        
        setVideos(orderedVideos);
        console.log(`✅ Loaded ${orderedVideos.length} featured videos`);
      } else {
        setVideos([]);
      }
    } catch (error) {
      console.error('❌ Error loading featured videos:', error);
      setVideos([]);
    }
  };

  // Helper to transform posts to VideoItem format
  const transformPosts = (posts: any[]): VideoItem[] => {
    return posts.map(post => ({
      id: post.id,
      cleaner: {
        user_id: post.user_id,
        name: post.user?.name || 'ChoreHero Cleaner',
        username: `@${post.user?.name?.toLowerCase().replace(/\s+/g, '') || 'cleaner'}`,
        rating_average: post.user?.cleaner_profiles?.rating_average || 0,
        total_jobs: post.user?.cleaner_profiles?.total_jobs || 0,
        hourly_rate: post.user?.cleaner_profiles?.hourly_rate || 0,
        service_title: 'Professional Cleaning',
        estimated_duration: '2-3 hours',
        avatar_url: post.user?.avatar_url || 'https://via.placeholder.com/50',
        bio: post.description || 'Professional cleaning specialist',
        video_profile_url: post.media_url || '',
        specialties: post.user?.cleaner_profiles?.specialties || ['Professional Cleaning'],
        verification_status: post.user?.cleaner_profiles?.verification_status || 'verified',
        is_available: post.user?.cleaner_profiles?.is_available ?? true,
        service_radius_km: post.user?.cleaner_profiles?.service_radius_km || 25,
      },
      video_url: post.media_url || '',
      title: post.title,
      description: post.description || '',
      liked: false,
      saved: false,
      likes: post.like_count || 0,
      comments: post.comment_count || 0,
      shares: 0,
      hashtags: post.tags || [],
      contentFit: 'cover',
    } as any));
  };

  const loadMockData = async () => {
    console.log('🎬 Demo data loading disabled - implement real video loading here');
    // TODO: Implement real video loading from content service
    // This should load videos from the database using contentService.getFeed()
    setVideos([]);
  };

  // Feature flag: always show curated cleaning videos when in demo mode
  const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

  const loadRealContent = async () => {
    try {
      console.log('🌐 Loading real content from database...');
      console.log('👤 Current user:', user ? `${user.name} (${user.role})` : 'No user');
      
      // Check if user is a guest - prioritize demo mode for guest users
      const isGuest = await guestModeService.isGuestUser();
      console.log('🚪 Is guest user:', isGuest);
      console.log('👤 Current user object:', user);
      console.log('🔑 User ID:', user?.id);
      console.log('📧 User email:', user?.email);
      
      // No mock videos - show real content only
      console.log('🎬 Loading real videos only (no mock data)');
      
      // For authenticated users, check if we have any cleaner profiles in the database
      const { data: cleanerProfiles, error: cleanerError } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'cleaner')
        .limit(1);
      
      console.log('📊 Database check - cleaner profiles:', {
        hasError: !!cleanerError,
        count: cleanerProfiles?.length || 0,
        error: cleanerError?.message
      });
      
      // If no cleaners found for authenticated users, show empty state
      if (cleanerError || !cleanerProfiles || cleanerProfiles.length === 0) {
        console.log('📭 No cleaners found in database for authenticated user');
        setVideos([]);
        return;
      }
      
      // Fetch content posts with cleaner profiles
      const response = await contentService.getFeed();
      console.log('📋 Content service response:', response);
      console.log('📋 Response structure:', {
        success: response.success,
        hasData: !!response.data,
        hasPosts: !!(response.data && response.data.posts),
        postsLength: response.data && response.data.posts ? response.data.posts.length : 0,
        error: response.error
      });
      
      if (response.success && response.data && response.data.posts && response.data.posts.length > 0) {
        // Transform content posts to video items
        const transformedVideos: VideoItem[] = response.data.posts.map(post => ({
          id: post.id,
          cleaner: {
            user_id: post.user_id,
            name: post.user?.name || 'ChoreHero Cleaner',
            username: `@${post.user?.name?.toLowerCase().replace(/\s+/g, '') || 'cleaner'}`,
            rating_average: post.user?.cleaner_profiles?.rating_average || 0, // 0 = New cleaner
            total_jobs: post.user?.cleaner_profiles?.total_jobs || 0,
            hourly_rate: post.user?.cleaner_profiles?.hourly_rate || 0, // 0 = Not set
            service_title: 'Professional Cleaning',
            estimated_duration: '2-3 hours',
            avatar_url: post.user?.avatar_url || 'https://via.placeholder.com/50',
            bio: post.description || 'Professional cleaning specialist',
            video_profile_url: post.media_url || '',
            specialties: ['Professional Cleaning'],
            verification_status: 'verified',
            is_available: true,
            service_radius_km: 25,
          },
          video_url: post.media_url || '',
          title: post.title,
          description: post.description || '',
          liked: false,
          saved: false,
          likes: post.like_count || 0,
          comments: post.comment_count || 0,
          shares: 0, // Not implemented yet
          hashtags: post.tags || [],
          contentFit: 'cover',
        } as any));
        
        console.log(`✅ Loaded ${transformedVideos.length} real content posts`);
        setVideos(transformedVideos);
        return; // Exit early on success
      } else if (response.success && response.data && Array.isArray(response.data) && response.data.length > 0) {
        // Handle direct array response (fallback)
        console.log('📋 Handling direct array response format');
        const transformedVideos: VideoItem[] = response.data.map(post => ({
          id: post.id,
          cleaner: {
            user_id: post.user_id,
            name: post.user?.name || 'ChoreHero Cleaner',
            username: `@${post.user?.name?.toLowerCase().replace(/\s+/g, '') || 'cleaner'}`,
            rating_average: post.user?.cleaner_profiles?.rating_average || 0,
            total_jobs: post.user?.cleaner_profiles?.total_jobs || 0,
            hourly_rate: post.user?.cleaner_profiles?.hourly_rate || 0,
            service_title: 'Professional Cleaning',
            estimated_duration: '2-3 hours',
            avatar_url: post.user?.avatar_url || 'https://via.placeholder.com/50',
            bio: post.description || 'Professional cleaning specialist',
            video_profile_url: post.media_url || '',
            specialties: ['Professional Cleaning'],
            verification_status: 'verified',
            is_available: true,
            service_radius_km: 25,
          },
          video_url: post.media_url || '',
          title: post.title,
          description: post.description || '',
        liked: false,
        saved: false,
          likes: post.like_count || 0,
          comments: post.comment_count || 0,
          shares: 0,
          hashtags: post.tags || [],
          contentFit: 'cover',
        } as any));
        console.log(`✅ Loaded ${transformedVideos.length} real content posts (direct array)`);
        setVideos(transformedVideos);
        return; // Exit early on success
      } else if (response.success && response.data && response.data.posts && response.data.posts.length === 0) {
        // Explicitly handle empty posts array
        console.log('📭 Database returned empty posts array');
        console.log('📭 No videos found - showing empty state');
        setVideos([]);
        console.log('✅ Empty posts handled');
        return;
      } else if (!response.success) {
        console.log('❌ Content service returned error:', response.error);
        console.log('❌ Content service error - showing empty state');
        setVideos([]);
        console.log('✅ Service error handled');
        return;
      }
      
      // No real content found - show empty state (no mock videos)
      console.log('📭 No real content found in database — showing empty state');
      setVideos([]);
      console.log('✅ Empty state set');
      
    } catch (error) {
      console.error('❌ Error loading real content:', error);
      console.log('❌ Loading error - showing empty state');
      setVideos([]);
      console.log('✅ Error handled with empty state');
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

  const onViewableItemsChanged = ({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      
      // Only reset if actually changing to a different video
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        
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
        if (isScreenFocused && !isPlaying) {
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

  // Button interaction handlers
  const handleLike = async (videoId: string, cleanerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isLiking = !likedVideos.has(videoId);
    
    setLikedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
    
    // Send like notification to cleaner (only when liking, not unliking)
    if (isLiking && user && cleanerId && user.id !== cleanerId) {
      try {
        await notificationService.sendLikeNotification(
          videoId,
          cleanerId,
          user.id,
          user.name || 'A customer',
          user.avatar_url
        );
        console.log('💓 Like notification sent to cleaner:', cleanerId);
      } catch (error) {
        console.log('Could not send like notification:', error);
      }
    }
  };

  const handleSave = (videoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSavedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const handleFollow = (cleanerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFollowedCleaners(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cleanerId)) {
        newSet.delete(cleanerId);
      } else {
        newSet.add(cleanerId);
      }
      return newSet;
    });
  };

  const handleComment = (videoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to comments or open comment modal
    Alert.alert('Comments', 'Comments feature coming soon!');
  };

  const handleShare = (videoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Share functionality
    Alert.alert('Share', 'Share feature coming soon!');
  };

  const handleBooking = (cleanerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Navigate to booking flow
    navigation.navigate('NewBookingFlow', { cleanerId });
  };


  const renderVideoItem = ({ item, index }: { item: VideoItem; index: number }) => {
    // Check if it's a video or image based on content type or file extension
    const isVideo = (item as any).content_type === 'video' || 
                    item.video_url.includes('.mov') || 
                    item.video_url.includes('.mp4') || 
                    item.video_url.includes('.avi');
    
    return (
      <View style={styles.videoContainer}>
        {/* Fixed Aspect Video Area */}
        <View style={styles.videoArea}>
        {isVideo ? (
            <View style={styles.videoFrame}>
          <ExpoVideoPlayer
          videoUrl={item.video_url}
          isActive={index === currentIndex}
          isPlaying={isPlaying && isScreenFocused}
                style={StyleSheet.absoluteFillObject}
                onTogglePlay={() => {
                  console.log('🎮 ExpoVideoPlayer onTogglePlay - current state:', isPlaying);
                  setIsPlaying(!isPlaying);
                }}
              />
              {/* Old pause overlay removed - now handled by center touch area */}
            </View>
          ) : (
            <View style={styles.videoFrame}>
              <Image 
                source={{ uri: item.video_url }} 
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
            setIsPlaying(!isPlaying);
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
            avatarUrl={item.cleaner?.avatar_url}
            username={item.cleaner?.username || item.cleaner?.name || 'Cleaner'}
            serviceTitle={item.cleaner?.service_title || 'Professional Cleaning'}
            verified={item.cleaner?.verification_status === 'verified'}
            isFollowing={followedCleaners.has(item.cleaner?.user_id || '')}
            onPressProfile={() => item.cleaner?.user_id && navigation.navigate('CleanerProfile', { cleanerId: item.cleaner.user_id })}
            onToggleFollow={() => item.cleaner?.user_id && handleFollow(item.cleaner.user_id)}
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
                style={[
                  styles.modernActionBubble,
                  {
                    width: layout.actionRail.buttonSize,
                    height: layout.actionRail.buttonSize,
                    borderRadius: layout.actionRail.buttonSize / 2,
                  }
                ]}
                onPress={() => handleLike(item.id, item.cleaner?.user_id || '')}
              >
                <Ionicons 
                  name={likedVideos.has(item.id) ? "heart" : "heart-outline"} 
                  size={24} 
                  color={DESIGN_TOKENS.colors.brand} 
                />
              </TouchableOpacity>
              {/* count removed for cleaner look */}
        </View>

            <View style={styles.actionButtonContainer}>
                    <TouchableOpacity 
                style={[
                  styles.modernActionBubble,
                  {
                    width: layout.actionRail.buttonSize,
                    height: layout.actionRail.buttonSize,
                    borderRadius: layout.actionRail.buttonSize / 2,
                  }
                ]}
                onPress={() => handleComment(item.id)}
                  >
                <Ionicons name="chatbubble-outline" size={22} color={DESIGN_TOKENS.colors.brand} />
                    </TouchableOpacity>
              {/* count removed for cleaner look */}
                </View>
                
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.modernActionBubble,
                  {
                    width: layout.actionRail.buttonSize,
                    height: layout.actionRail.buttonSize,
                    borderRadius: layout.actionRail.buttonSize / 2,
                  }
                ]}
                onPress={() => handleSave(item.id)}
              >
                <Ionicons
                  name={savedVideos.has(item.id) ? "bookmark" : "bookmark-outline"}
                  size={22}
                  color={DESIGN_TOKENS.colors.brand}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.actionButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.modernActionBubble,
                  {
                    width: layout.actionRail.buttonSize,
                    height: layout.actionRail.buttonSize,
                    borderRadius: layout.actionRail.buttonSize / 2,
                  }
                ]}
                onPress={() => handleShare(item.id)}
              >
                <Ionicons name="share-outline" size={22} color={DESIGN_TOKENS.colors.brand} />
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
                    {(item as any).title || (item as any).post?.title || item.cleaner?.service_title || 'Cleaning Service'}
                  </Text>
                  <View style={styles.durationBadge}>
                    <Ionicons name="time-outline" size={14} color="#3AD3DB" />
                    <Text style={styles.durationBadgeText}>
                      {(item as any).estimated_duration || item.cleaner?.estimated_duration || '2-3 hrs'}
                    </Text>
                  </View>
                </View>
                <View style={styles.descriptionDivider} />
                <Text style={styles.descriptionText} numberOfLines={4}>
                  {(item as any).description || (item as any).post?.description || item.cleaner?.bio || 'Professional cleaning service with attention to detail and customer satisfaction.'}
                </Text>
                {/* Close Button */}
                <TouchableOpacity 
                  style={styles.closeDescriptionButton}
                  onPress={toggleDescriptionCard}
                >
                  <Ionicons name="chevron-down" size={24} color={DESIGN_TOKENS.colors.text.secondary} />
                </TouchableOpacity>
            </Animated.View>

            {/* Enhanced Booking Section with Even Spacing */}
            <BookingBubble
              hourlyRate={(item as any).hourly_rate || item.cleaner?.hourly_rate || 0}
              rating={(item as any).rating || item.cleaner?.rating_average || 0}
              duration={(item as any).estimated_duration || item.cleaner?.estimated_duration}
              isSmall={device.isSmall}
              onToggleInfo={toggleDescriptionCard}
              onBook={() => item.cleaner?.user_id && handleBooking(item.cleaner.user_id)}
              height={layout.bookingSection.height}
              marginHorizontal={layout.bookingSection.marginHorizontal}
            />
          </View>

        </View>
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
    itemVisiblePercentThreshold: 50,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={styles.loadingText}>Loading cleaners...</Text>
      </View>
    );
  }

  // Filter videos by proximity (within 50km)
  const filteredVideos = location
    ? videos.filter(v => {
        const cleaner = v.cleaner;
        // For mock data, add random lat/lng near user (for demo)
        // In real app, cleaner would have lat/lng
        if (!cleaner.latitude || !cleaner.longitude) return true;
        const dist = locationService.calculateDistance(
          location.latitude,
          location.longitude,
          cleaner.latitude,
          cleaner.longitude
        );
        return dist <= 50;
      })
    : videos;

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
              onPress={() => navigation.goBack()}
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
            <Text style={styles.emptyStateTitle}>No cleaning videos yet</Text>
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
              onPress={() => navigation.navigate('Discover')}
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
          keyExtractor={(item) => item.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={onRefresh}
          getItemLayout={(data, index) => ({
            length: height,
            offset: height * index,
            index,
          })}
        />
      )}
      
      {/* Floating Navigation - Show appropriate navigation based on effective role */}
      {isCleaner ? (
        <CleanerFloatingNavigation navigation={navigation as any} currentScreen="Heroes" />
      ) : (
        <FloatingNavigation navigation={navigation as any} currentScreen="Content" />
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

  // Modern Action Section - Lowered buttons without bubble background
  modernActionSection: {
    position: 'absolute',
    // Position is provided dynamically via getVideoFeedLayout(device)
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.lg, // Increased spacing for even distribution
    zIndex: 15, // Higher than unifiedFeedOverlay (10) and videoTapOverlay (5)
    paddingVertical: DESIGN_TOKENS.spacing.sm, // Vertical padding
    paddingHorizontal: DESIGN_TOKENS.spacing.xs, // Minimal horizontal padding
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