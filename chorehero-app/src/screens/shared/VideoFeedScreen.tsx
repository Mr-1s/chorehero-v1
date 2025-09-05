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
} from 'react-native';
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
import CleanerFloatingNavigation from '../../components/CleanerFloatingNavigation';
import { useLocationContext } from '../../context/LocationContext';
import { notificationService } from '../../services/notificationService';
import { contentService } from '../../services/contentService';
import { useAuth } from '../../hooks/useAuth';
import { locationService } from '../../services/location';
import { guestModeService } from '../../services/guestModeService';

type TabParamList = {
  Home: undefined;
  Discover: undefined;
  Bookings: undefined;
  Messages: undefined;
  Profile: undefined;
  CleanerProfile: { cleanerId: string };
  SimpleBookingFlow: {
    cleanerId: string;
    serviceType: string;
    fromVideoFeed: boolean;
    videoTitle: string;
  };
};

type VideoFeedScreenNavigationProp = BottomTabNavigationProp<TabParamList, 'Home'>;

interface VideoFeedScreenProps {
  navigation: VideoFeedScreenNavigationProp;
}



import RoleBasedUI, { useRoleFeatures } from '../../components/RoleBasedUI';


const { width, height } = Dimensions.get('window');

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
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
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
    <TouchableWithoutFeedback onPress={onTogglePlay}>
      <View style={style}>
        <VideoView
          style={StyleSheet.absoluteFillObject}
          player={player}
          allowsFullscreen={false}
          allowsPictureInPicture={false}
          contentFit="cover"
          nativeControls={false}
        />
        
        {/* Loading indicator */}
        {!isReady && (
          <View style={styles.videoErrorOverlay}>
            <ActivityIndicator size="large" color="rgba(255, 255, 255, 0.8)" />
            <Text style={styles.videoErrorText}>Loading...</Text>
          </View>
        )}
        
        {/* Play/Pause Overlay */}
        {!isPlaying && isActive && isReady && (
          <View style={styles.playPauseOverlay}>
            <TouchableOpacity style={styles.playPauseButton} onPress={onTogglePlay}>
              <Ionicons name="play" size={40} color="rgba(255, 255, 255, 0.9)" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const VideoFeedScreen = ({ navigation }: VideoFeedScreenProps) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [isCardVisible, setIsCardVisible] = useState(true); // Default to visible for better UX

  const flatListRef = useRef<FlatList>(null);
  const { location } = useLocationContext();
  const { user } = useAuth();
  const { showUploadButton, isCleaner } = useRoleFeatures();

  useEffect(() => {
    initializeData();
  }, []);



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

  const togglePlay = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPlaying(!isPlaying);
  };

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
    console.log('🚀 Current videos length:', videos.length);

    try {
      console.log('🌐 About to call loadRealContent...');
      await loadRealContent();
      console.log('✅ Real content loading completed');
      console.log('✅ Videos after loading:', videos.length);
    } catch (error) {
      console.error('❌ Error loading real content:', error);
      console.error('❌ Error details:', error.message || error);
      // Set empty state if real content loading fails
      setVideos([]);
    } finally {
      setLoading(false);
      console.log('✅ VideoFeedScreen: Data initialization complete');
      console.log('✅ Final videos length:', videos.length);
      console.log('✅ Loading state:', false);
    }
  };

  const loadMockData = async () => {
    console.log('🎬 Demo data loading disabled - implement real video loading here');
    // TODO: Implement real video loading from content service
    // This should load videos from the database using contentService.getFeed()
    setVideos([]);
  };

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
      
      // If user is a guest, always show professional demo videos
      if (isGuest) {
        console.log('🎬 Guest user detected - Loading professional demo videos');
        const guestVideos = await guestModeService.getGuestVideos();
        console.log('📹 Guest videos received:', guestVideos.length, 'videos');
        console.log('📹 First video:', guestVideos[0]?.title);
        const transformedGuestVideos: VideoItem[] = guestVideos.map(video => ({
          id: video.id,
          cleaner: {
            user_id: video.id,
            name: video.cleaner_name,
            username: `@${video.cleaner_name.toLowerCase().replace(/\s+/g, '')}`,
            rating_average: Math.round((4.6 + Math.random() * 0.4) * 10) / 10, // 4.6-5.0 rounded to 1 decimal
            total_jobs: Math.floor(video.view_count / 100),
            hourly_rate: 25 + Math.floor(Math.random() * 20),
            service_title: `Professional ${video.category} Cleaning`,
            estimated_duration: `${Math.floor(video.duration / 60)}-${Math.floor(video.duration / 60) + 1} hours`,
            avatar_url: video.cleaner_avatar,
            bio: video.description.substring(0, 100) + '...',
            video_profile_url: video.video_url,
            specialties: [video.category, 'Professional Cleaning'],
            verification_status: 'verified',
            is_available: true,
            service_radius_km: 25,
          },
          video_url: video.video_url,
          title: video.title,
          description: video.description,
          liked: false,
          saved: false,
          likes: video.like_count,
          comments: Math.floor(video.like_count * 0.1),
          shares: Math.floor(video.like_count * 0.05),
          views: video.view_count,
          location: 'Professional Service Area',
          tags: ['professional', video.category.toLowerCase(), 'deep-clean'],
          is_featured: true,
          created_at: video.created_at,
        }));
        setVideos(transformedGuestVideos);
        console.log(`✅ Loaded ${transformedGuestVideos.length} professional videos for guest user`);
        return;
      }
      
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
            rating_average: 4.8, // Default rating, can be fetched from cleaner profile
            total_jobs: 0, // Can be fetched from cleaner profile
            hourly_rate: 85, // Default rate
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
          rating_average: 4.8,
            total_jobs: 0,
          hourly_rate: 85,
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
      
      // No real content found - show empty state
      console.log('📭 No real content found in database');
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

  const handleLike = async (videoId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const video = videos.find(v => v.id === videoId);
    if (!video || !user) return;
    
    const isLiking = !video.liked;
    
    setVideos(prevVideos => 
      prevVideos.map(v => 
        v.id === videoId 
          ? { ...v, liked: !v.liked, likes: v.liked ? v.likes - 1 : v.likes + 1 }
          : v
      )
    );

    // Send notification to cleaner when customer likes their video
    if (isLiking && video.cleaner.user_id && user.id !== video.cleaner.user_id) {
      try {
        await notificationService.sendLikeNotification(
          videoId,
          video.cleaner.user_id,
          user.id,
          user.name || 'A customer',
          user.avatar_url
        );
      } catch (error) {
        console.error('Error sending like notification:', error);
      }
    }
  };

  const handleComment = async (videoId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    
    // Update comment count optimistically
    setVideos(prevVideos => 
      prevVideos.map(v => 
        v.id === videoId 
          ? { ...v, comments: v.comments + 1 }
          : v
      )
    );
    
    // TODO: Navigate to comment screen or open comment modal
    console.log('Opening comments for video:', videoId);
    Alert.alert('Comments', `Comments for "${video.title}" by ${video.cleaner.name}`);
  };

  const handleShare = async (video: VideoItem) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Update share count optimistically
    setVideos(prevVideos => 
      prevVideos.map(v => 
        v.id === video.id 
          ? { ...v, shares: (v.shares || 0) + 1 }
          : v
      )
    );
    
    // Show share options
    Alert.alert(
      'Share Video',
      `Share "${video.title}" by ${video.cleaner.name}`,
      [
        {
          text: 'Copy Link',
          onPress: () => {
            // TODO: Copy video link to clipboard
            Alert.alert('Link Copied', 'Video link copied to clipboard!');
          }
        },
        {
          text: 'Share to Social Media',
          onPress: () => {
            // TODO: Open native share sheet
            Alert.alert('Share', 'Opening share options...');
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleBoost = async (videoId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Boost', 'Boost feature coming soon!');
  };


  const handleBookService = async (cleaner: CleanerProfile) => {
    console.log('🎯 Book service button pressed for:', cleaner.name);
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.log('Haptics not available:', error);
    }
    
    // Check if current user is a cleaner trying to book
    if (user?.role === 'cleaner') {
      Alert.alert(
        'Switch to Customer Account',
        'To book cleaning services, you need to use a customer account. Would you like to switch to customer mode or create a customer account?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Switch Account',
            onPress: () => {
              // Navigate to settings where they can switch accounts
              navigation.navigate('Profile');
            },
          },
        ]
      );
      return;
    }
    
    // Create real bookings for customers
    console.log('🎯 Customer booking service from:', cleaner.name);
    
    navigation.navigate('SimpleBookingFlow', {
      cleanerId: cleaner.user_id,
      serviceType: cleaner.service_title || 'Residential',
      fromVideoFeed: true, // Flag to indicate this came from video feed
      videoTitle: cleaner.service_title // Pass the video title for context
    });
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
      setCurrentIndex(viewableItems[0].index);
      // Auto-resume playing when switching to a new video
      if (isScreenFocused && !isPlaying) {
        setIsPlaying(true);
      }
    }
  };

  const renderVideoItem = ({ item, index }: { item: VideoItem; index: number }) => {
    // Check if it's a video or image based on content type or file extension
    const isVideo = (item as any).content_type === 'video' || 
                    item.video_url.includes('.mov') || 
                    item.video_url.includes('.mp4') || 
                    item.video_url.includes('.avi');
    
    return (
      <View style={styles.videoContainer}>
        {isVideo ? (
          <ExpoVideoPlayer
          videoUrl={item.video_url}
          isActive={index === currentIndex}
          isPlaying={isPlaying && isScreenFocused}
          style={styles.video}
          onTogglePlay={togglePlay}
        />
        ) : (
          <TouchableWithoutFeedback onPress={togglePlay}>
            <View style={styles.video}>
              <Image 
                source={{ uri: item.video_url }} 
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
              {/* Show demo indication for images */}
              <View style={styles.imageOverlay}>
                <Text style={styles.imageLabel}>Demo Preview - Tap to Book</Text>
              </View>
            </View>
          </TouchableWithoutFeedback>
        )}
        
        {/* Play Icon */}
        <PlayIcon 
          visible={!isPlaying && index === currentIndex} 
          onPress={togglePlay}
        />

        {/* Cleaner Profile Header */}
        <TouchableOpacity 
          style={styles.cleanerProfileHeader}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            console.log('🎯 Navigating to cleaner profile:', item.cleaner.name);
            // Navigate to cleaner profile screen
            navigation.navigate('CleanerProfile', { cleanerId: item.cleaner.user_id });
          }}
        >
          <Image 
            source={{ uri: item.cleaner.avatar_url || 'https://via.placeholder.com/50' }} 
            style={styles.cleanerProfileAvatar} 
          />
          <View style={styles.cleanerProfileInfo}>
            <Text style={styles.cleanerProfileUsername} numberOfLines={1} ellipsizeMode="tail">{item.cleaner.username}</Text>
            <Text style={styles.cleanerProfileBio} numberOfLines={1} ellipsizeMode="tail">{item.cleaner.bio || 'Professional cleaning specialist'}</Text>
          </View>
        </TouchableOpacity>

        {/* Action Bubbles - Classic right-side placement */}
        <View style={styles.rightSideActions}>
          <BubbleStack
            onLikePress={() => handleLike(item.id)}
            onBoostPress={() => handleComment(item.id)}
            onSharePress={() => handleShare(item)}
            likeCount={formatCount(item.likes)}
            boostCount={formatCount(item.comments)}
            liked={item.liked}
          />
        </View>

        {/* Modern Service Card */}
        {isCardVisible && (
          <View style={styles.modernServiceCardWrapper}>
            <BlurView intensity={100} style={styles.modernServiceCard}>
              <View style={styles.modernServiceContent}>
                {/* Header with close button */}
                <View style={styles.modernServiceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.modernServiceTitle}>
                      {(item as any).metadata?.service_category 
                        ? `${item.cleaner.service_title || 'Professional Service'}`
                        : item.cleaner.service_title}
                    </Text>
                    <Text style={styles.modernServicePrice}>
                      {(item as any).metadata?.pricing_display 
                        ? `${(item as any).metadata.pricing_display}${(item as any).metadata?.duration_display ? ` • ${(item as any).metadata.duration_display}` : ''}`
                        : item.cleaner.hourly_rate}
                    </Text>
                  </View>
                    <TouchableOpacity 
                    style={styles.modernCloseButton}
                    onPress={() => setIsCardVisible(false)}
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>
                
                {/* Rating and Duration */}
                <View style={styles.modernServiceMeta}>
                  <View style={styles.modernMetaItem}>
                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={14} color="#FFA500" />
                      <Text style={styles.ratingText}>{item.cleaner.rating_average}</Text>
                      <Text style={styles.reviewCountText}>({item.cleaner.total_jobs})</Text>
                  </View>
                  </View>
                  <View style={styles.modernMetaDivider} />
                  <View style={styles.modernMetaItem}>
                    <Ionicons name="time-outline" size={14} color="#6B7280" />
                    <Text style={styles.durationText}>{item.cleaner.estimated_duration}</Text>
                  </View>
                </View>
                


                {/* Book Button */}
                <TouchableOpacity 
                  style={styles.modernBookButton}
                  onPress={() => handleBookService(item.cleaner)}
                  activeOpacity={0.8}
                  disabled={false}
                >
                  <LinearGradient
                    colors={['#3ad3db', '#2DD4BF', '#14B8A6']}
                    style={styles.modernBookButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.modernBookButtonText}>Book Now</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </BlurView>
          </View>
        )}

        {/* Card Toggle Button */}
        <TouchableOpacity 
          style={styles.cardToggleButton}
          onPress={() => setIsCardVisible(!isCardVisible)}
        >
          <Ionicons 
            name={isCardVisible ? "chevron-down" : "chevron-up"} 
            size={24} 
            color="#14B8A6" 
          />
        </TouchableOpacity>
      </View>
    );
  };

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0891b2" />
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
    <RoleBasedUI navigation={navigation as any} showUploadButton={showUploadButton}>
      <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" translucent />
      {/* Header Controls */}




      {/* Search Button - Top Right */}
      <TouchableOpacity 
        style={styles.searchButtonTopRight}
        onPress={() => navigation.navigate('Discover')}
      >
        <Ionicons name="search" size={24} color="#64748B" />
      </TouchableOpacity>
      
      {filteredVideos.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <LinearGradient
            colors={['#0891b2', '#06b6d4']}
            style={styles.emptyStateGradient}
          >
            <View style={styles.emptyStateIconContainer}>
              <LinearGradient colors={['#3ad3db', '#2BC8D4']} style={styles.emptyStateIconGradient}>
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
      
      {/* Floating Navigation - Show appropriate navigation based on user role */}
      {user?.role === 'cleaner' ? (
        <CleanerFloatingNavigation navigation={navigation as any} currentScreen="Heroes" unreadCount={3} />
      ) : (
        <FloatingNavigation navigation={navigation as any} currentScreen="Content" />
      )}
      </View>
    </RoleBasedUI>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 0,
    margin: 0,
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
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
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
    numberOfLines: 1,
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
    backdropFilter: 'blur(20px)',
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
  modernServiceCardWrapper: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 80, // Adjusted to leave space for action buttons
    zIndex: 10,
  },
  modernServiceCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(58, 211, 219, 0.2)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    shadowColor: '#3ad3db',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  modernServiceContent: {
    padding: 20,
  },
  modernServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  modernServiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  modernServicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3ad3db',
  },
  modernCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  modernServiceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.1)',
  },
  modernMetaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernMetaDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    marginHorizontal: 16,
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
    shadowColor: '#3ad3db',
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

});

export default VideoFeedScreen; 