import { useState, useEffect, useCallback, useRef } from 'react';
import { TIKTOK_UI, VIDEO_CONFIG } from '../utils/constants';
import { MOCK_CLEANERS } from '../utils/mockData';
import { supabase } from '../services/supabase';
import { initializeSampleData } from '../services/sampleData';
import { Database } from '../types/database';

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

export const useVideoFeed = () => {
  const [videos, setVideos] = useState<CleanerVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [useRealData, setUseRealData] = useState(true);
  const pageRef = useRef(1);

  useEffect(() => {
    loadInitialVideos();
  }, []);

  const generateMockVideos = (count: number, startIndex: number = 0): CleanerVideo[] => {
    const mockVideos: CleanerVideo[] = [];
    
    for (let i = 0; i < count; i++) {
      const cleaner = MOCK_CLEANERS[Math.floor(Math.random() * MOCK_CLEANERS.length)];
      const videoTypes = [
        'before_after_kitchen',
        'speed_cleaning',
        'organization_tips',
        'product_review',
        'cleaning_dance',
        'time_lapse',
      ];
      
      const videoType = videoTypes[Math.floor(Math.random() * videoTypes.length)];
      
      mockVideos.push({
        id: `video_${startIndex + i}`,
        cleaner_id: cleaner.id,
        cleaner: {
          id: cleaner.id,
          name: cleaner.name,
          avatar_url: cleaner.avatar_url || '',
          rating: cleaner.rating_average,
          specialty: cleaner.specialties[0] || 'General cleaning',
          bio: `${cleaner.specialties.join(', ')} specialist with ${cleaner.total_jobs} completed jobs`,
          hourly_rate: cleaner.hourly_rate,
        },
        video_url: `https://storage.googleapis.com/chorehero-videos/${videoType}_${startIndex + i}.mp4`,
        thumbnail_url: `https://storage.googleapis.com/chorehero-thumbnails/${videoType}_${startIndex + i}.jpg`,
        title: getVideoTitle(videoType, cleaner.name),
        description: getVideoDescription(videoType),
        duration: Math.floor(Math.random() * 25) + 15, // 15-40 seconds
        created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        metrics: {
          likes: Math.floor(Math.random() * 1000),
          views: Math.floor(Math.random() * 10000),
          shares: Math.floor(Math.random() * 100),
          bookings: Math.floor(Math.random() * 50),
          liked: Math.random() > 0.8,
          viewed: false,
        },
        tags: getVideoTags(videoType),
        music: Math.random() > 0.5 ? {
          title: 'Cleaning Vibes',
          artist: 'ChoreHero Music',
          url: 'https://audio.googleapis.com/chorehero-music/track_1.mp3',
        } : undefined,
      });
    }
    
    return mockVideos;
  };

  const getVideoTitle = (type: string, cleanerName: string): string => {
    const titles = {
      before_after_kitchen: `${cleanerName}'s Amazing Kitchen Transformation! 🧹✨`,
      speed_cleaning: `${cleanerName} Speed Cleans in 60 Seconds! ⚡`,
      organization_tips: `${cleanerName}'s Organization Hack Will Blow Your Mind! 🤯`,
      product_review: `${cleanerName} Tests This Viral Cleaning Product! 🧽`,
      cleaning_dance: `${cleanerName}'s Cleaning Dance Challenge! 💃`,
      time_lapse: `${cleanerName}'s 3-Hour Deep Clean in 30 Seconds! ⏰`,
    };
    
    return titles[type as keyof typeof titles] || `${cleanerName}'s Cleaning Tips`;
  };

  const getVideoDescription = (type: string): string => {
    const descriptions = {
      before_after_kitchen: 'From chaos to spotless in one session! Book me for your kitchen transformation 🏠',
      speed_cleaning: 'Quick tips for busy people! Every second counts when you have company coming over 🏃‍♀️',
      organization_tips: 'This one trick will change how you organize forever! Try it and let me know 📝',
      product_review: 'Honest review of the latest cleaning trend. Worth the hype? 🤔',
      cleaning_dance: 'Making cleaning fun with music! Who says chores have to be boring? 🎵',
      time_lapse: 'The satisfaction of a complete transformation! Book for your deep clean 💯',
    };
    
    return descriptions[type as keyof typeof descriptions] || 'Professional cleaning tips and tricks!';
  };

  const getVideoTags = (type: string): string[] => {
    const baseTags = ['cleaning', 'chorehero', 'home', 'organization'];
    const typeTags = {
      before_after_kitchen: ['kitchen', 'transformation', 'beforeafter'],
      speed_cleaning: ['speedcleaning', 'quicktips', 'efficient'],
      organization_tips: ['organization', 'tips', 'lifehacks'],
      product_review: ['review', 'products', 'honest'],
      cleaning_dance: ['dance', 'fun', 'music'],
      time_lapse: ['timelapse', 'deepclean', 'satisfying'],
    };
    
    return [...baseTags, ...(typeTags[type as keyof typeof typeTags] || [])];
  };

  const loadInitialVideos = async () => {
    setLoading(true);
    try {
      if (useRealData) {
        await loadVideosFromSupabase();
      } else {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const initialVideos = generateMockVideos(TIKTOK_UI.feedSettings.preloadCount);
        setVideos(initialVideos);
        pageRef.current = 2;
      }
    } catch (error) {
      console.error('Error loading initial videos:', error);
      // Fallback to mock data
      const initialVideos = generateMockVideos(TIKTOK_UI.feedSettings.preloadCount);
      setVideos(initialVideos);
      pageRef.current = 2;
    } finally {
      setLoading(false);
    }
  };

  const loadVideosFromSupabase = async () => {
    try {
      // Initialize sample data if needed
      await initializeSampleData();

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
      }
    } catch (error) {
      console.error('Error loading videos from Supabase:', error);
      throw error;
    }
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
    loadMore,
    refresh,
    like,
    share,
    markAsViewed,
    getVideoById,
    getVideosByCleanerId,
  };
}; 