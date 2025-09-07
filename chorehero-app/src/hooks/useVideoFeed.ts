import { useState, useEffect, useCallback, useRef } from 'react';
import { TIKTOK_UI, VIDEO_CONFIG } from '../utils/constants';
import { supabase } from '../services/supabase';
import { Database } from '../types/database';
import { guestModeService } from '../services/guestModeService';
import { videoFeedAlgorithmService } from '../services/videoFeedAlgorithmService';

interface VideoMetrics {
  likes: number;
  views: number;
  shares: number;
  bookings: number;
  liked: boolean;
  viewed: boolean;
}

interface CleanerVideo {
  id: string;
  cleaner_id: string;
  cleaner: {
    id: string;
    name: string;
    avatar_url: string;
    rating: number;
    specialty: string;
    bio: string;
    hourly_rate: number;
  };
  video_url: string;
  thumbnail_url: string;
  title: string;
  description: string;
  duration: number;
  created_at: string;
  metrics: VideoMetrics;
  tags: string[];
  music?: {
    title: string;
    artist: string;
    url: string;
  };
}

type CleanerWithProfile = Database['public']['Tables']['users']['Row'] & {
  cleaner_profiles: Database['public']['Tables']['cleaner_profiles']['Row'];
};

export const useVideoFeed = (useEnhancedAlgorithm: boolean = false) => {
  const [videos, setVideos] = useState<CleanerVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [useRealData, setUseRealData] = useState(true);
  const [sortPreference, setSortPreference] = useState<'balanced' | 'proximity' | 'engagement' | 'price'>('balanced');
  const pageRef = useRef(1);

  useEffect(() => {
    loadInitialVideos();
  }, []);

  const generateMockVideos = (count: number, startIndex: number = 0): CleanerVideo[] => {
    console.log('🎬 Demo video generation disabled - implement real video loading here');
    // TODO: Implement real video loading from content service
    return [];
  };



  const loadInitialVideos = async () => {
    setLoading(true);
    try {
      if (useEnhancedAlgorithm) {
        await loadEnhancedVideos();
      } else {
        await loadVideosFromSupabase();
      }
    } catch (error) {
      console.error('Error loading initial videos:', error);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadEnhancedVideos = async () => {
    try {
      // Check if user is a guest
      const isGuest = await guestModeService.isGuestUser();
      
      if (isGuest) {
        // For guests, use the existing guest video logic
        await loadVideosFromSupabase();
        return;
      }
      
      // For real users, use enhanced algorithm
      // Note: This requires user auth context - would need to be passed in
      // For now, fall back to regular loading
      console.log('🚀 Enhanced algorithm would be used here with user context');
      await loadVideosFromSupabase();
    } catch (error) {
      console.error('Error in enhanced video loading:', error);
      await loadVideosFromSupabase(); // Fallback
    }
  };

  const loadVideosFromSupabase = async () => {
    try {
      // Check if user is a guest
      const isGuest = await guestModeService.isGuestUser();
      
      // Try to get real cleaner data first
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          cleaner_profiles (*)
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .not('cleaner_profiles', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        const videoItems = data.map((cleaner, index) => 
          transformCleanerToVideo(cleaner as CleanerWithProfile, index)
        );
        setVideos(videoItems);
        pageRef.current = 2;
      } else if (isGuest) {
        // If no real data and user is guest, show professional videos
        console.log('🎬 Loading professional videos for guest user');
        const guestVideos = await guestModeService.getGuestVideos();
        const transformedVideos = guestVideos.map((video, index) => 
          transformGuestVideoToCleanerVideo(video, index)
        );
        setVideos(transformedVideos);
        pageRef.current = 2;
      }
    } catch (error) {
      console.error('Error loading videos from Supabase:', error);
      throw error;
    }
  };

  const transformGuestVideoToCleanerVideo = (video: any, index: number): CleanerVideo => {
    return {
      id: video.id,
      cleaner_id: video.id,
      cleaner: {
        id: video.id,
        name: video.cleaner_name,
        avatar_url: video.cleaner_avatar,
        rating: 4.8 + Math.random() * 0.2,
        total_jobs: video.view_count / 100,
        bio: video.description.substring(0, 100) + '...',
        verified: true,
        specialties: [video.category],
        hourly_rate: 25 + Math.floor(Math.random() * 20),
      },
      video_url: video.video_url,
      title: video.title,
      description: video.description,
      thumbnail: video.thumbnail_url,
      duration: video.duration,
      view_count: video.view_count,
      like_count: video.like_count,
      share_count: Math.floor(video.like_count * 0.1),
      created_at: video.created_at,
      location: 'Professional Service Area',
      tags: ['professional', video.category.toLowerCase(), 'deep-clean'],
      is_featured: true,
      isGuestContent: true,
    };
  };

  const transformCleanerToVideo = (cleaner: CleanerWithProfile, index: number): CleanerVideo => {
    const specialties = cleaner.cleaner_profiles?.specialties || ['General cleaning'];
    const videoType = getVideoTypeFromSpecialty(specialties[0]);
    
    return {
      id: `supabase_${cleaner.id}`,
      cleaner_id: cleaner.id,
      cleaner: {
        id: cleaner.id,
        name: cleaner.name,
        avatar_url: cleaner.avatar_url || '',
        rating: cleaner.cleaner_profiles?.rating_average || 4.9,
        specialty: specialties[0],
        bio: cleaner.cleaner_profiles?.bio || `${specialties.join(', ')} specialist`,
        hourly_rate: cleaner.cleaner_profiles?.hourly_rate || 89,
      },
      video_url: cleaner.cleaner_profiles?.video_profile_url || `https://assets.mixkit.co/videos/7862/7862-720.mp4`,
      thumbnail_url: `https://storage.googleapis.com/chorehero-thumbnails/${videoType}_${index}.jpg`,
      title: getVideoTitle(videoType, cleaner.name),
      description: getVideoDescription(videoType),
      duration: Math.floor(Math.random() * 25) + 15,
      created_at: cleaner.created_at,
      metrics: {
        likes: Math.floor(Math.random() * 1000) + 500,
        views: Math.floor(Math.random() * 10000) + 1000,
        shares: Math.floor(Math.random() * 100) + 50,
        bookings: cleaner.cleaner_profiles?.total_jobs || 0,
        liked: Math.random() > 0.8,
        viewed: false,
      },
      tags: getVideoTags(videoType),
      music: Math.random() > 0.5 ? {
        title: 'Cleaning Vibes',
        artist: 'ChoreHero Music',
        url: 'https://audio.googleapis.com/chorehero-music/track_1.mp3',
      } : undefined,
    };
  };

  const getVideoTypeFromSpecialty = (specialty: string): string => {
    const specialtyMap: { [key: string]: string } = {
      'Kitchen': 'before_after_kitchen',
      'Bathroom': 'speed_cleaning',
      'Carpet': 'time_lapse',
      'Windows': 'organization_tips',
      'Full House': 'cleaning_dance',
      'Office': 'product_review',
    };
    
    return specialtyMap[specialty] || 'speed_cleaning';
  };

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newVideos = generateMockVideos(
        TIKTOK_UI.feedSettings.preloadCount,
        (pageRef.current - 1) * TIKTOK_UI.feedSettings.preloadCount
      );
      
      setVideos(prev => [...prev, ...newVideos]);
      pageRef.current += 1;
      
      // Simulate end of feed after 50 videos
      if (videos.length >= 50) {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more videos:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, videos.length]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const freshVideos = generateMockVideos(TIKTOK_UI.feedSettings.preloadCount);
      setVideos(freshVideos);
      pageRef.current = 2;
      setHasMore(true);
    } catch (error) {
      console.error('Error refreshing videos:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const like = useCallback(async (videoId: string) => {
    try {
      setVideos(prev => prev.map(video => {
        if (video.id === videoId) {
          const wasLiked = video.metrics.liked;
          return {
            ...video,
            metrics: {
              ...video.metrics,
              liked: !wasLiked,
              likes: wasLiked ? video.metrics.likes - 1 : video.metrics.likes + 1,
            },
          };
        }
        return video;
      }));
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error('Error liking video:', error);
    }
  }, []);

  const share = useCallback(async (videoId: string) => {
    try {
      setVideos(prev => prev.map(video => {
        if (video.id === videoId) {
          return {
            ...video,
            metrics: {
              ...video.metrics,
              shares: video.metrics.shares + 1,
            },
          };
        }
        return video;
      }));
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error('Error sharing video:', error);
    }
  }, []);

  const markAsViewed = useCallback(async (videoId: string) => {
    try {
      setVideos(prev => prev.map(video => {
        if (video.id === videoId && !video.metrics.viewed) {
          return {
            ...video,
            metrics: {
              ...video.metrics,
              viewed: true,
              views: video.metrics.views + 1,
            },
          };
        }
        return video;
      }));
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error marking video as viewed:', error);
    }
  }, []);

  const getVideoById = useCallback((videoId: string) => {
    return videos.find(video => video.id === videoId);
  }, [videos]);

  const getVideosByCleanerId = useCallback((cleanerId: string) => {
    return videos.filter(video => video.cleaner_id === cleanerId);
  }, [videos]);

  return {
    videos,
    loading,
    hasMore,
    refreshing,
    sortPreference,
    setSortPreference,
    loadMore,
    refresh,
    like,
    share,
    markAsViewed,
    getVideoById,
    getVideosByCleanerId,
  };
}; 