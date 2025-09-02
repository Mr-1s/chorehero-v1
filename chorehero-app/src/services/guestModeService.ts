import { supabase } from './supabase';
import { contentService } from './contentService';
import { categoryService } from './category';

export interface GuestModeData {
  videos: GuestVideo[];
  services: GuestService[];
  cleaners: GuestCleaner[];
}

export interface GuestVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  cleaner_name: string;
  cleaner_avatar: string;
  duration: number;
  view_count: number;
  like_count: number;
  category: string;
  created_at: string;
}

export interface GuestService {
  id: string;
  name: string;
  description: string;
  image_url: string;
  rating: number;
  price_range: string;
  category: string;
}

export interface GuestCleaner {
  id: string;
  name: string;
  avatar_url: string;
  rating: number;
  total_jobs: number;
  specialties: string[];
  bio: string;
  hourly_rate: number;
}

class GuestModeService {
  private professionalVideos: GuestVideo[] = [
    {
      id: 'prof-video-1',
      title: 'Professional Kitchen Deep Clean Transformation',
      description: 'Watch this amazing kitchen transformation using professional-grade equipment and techniques. From greasy surfaces to sparkling clean!',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=600&fit=crop',
      cleaner_name: 'Professional Cleaning Co.',
      cleaner_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
      duration: 180,
      view_count: 15420,
      like_count: 1245,
      category: 'Kitchen',
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'prof-video-2',
      title: 'Bathroom Grout Restoration Magic',
      description: 'Professional grout cleaning and restoration techniques that make old bathrooms look brand new. Amazing results!',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=600&fit=crop',
      cleaner_name: 'Elite Bathroom Cleaners',
      cleaner_avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b754?w=100&h=100&fit=crop&crop=face',
      duration: 210,
      view_count: 23150,
      like_count: 1876,
      category: 'Bathroom',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'prof-video-3',
      title: 'Living Room Deep Clean & Organization',
      description: 'Complete living room transformation including upholstery cleaning, carpet deep clean, and professional organization.',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=600&fit=crop',
      cleaner_name: 'Home Refresh Specialists',
      cleaner_avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
      duration: 165,
      view_count: 18720,
      like_count: 1432,
      category: 'Living Room',
      created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'prof-video-4',
      title: 'Master Bedroom Cleaning & Sanitization',
      description: 'Professional bedroom cleaning including mattress sanitization, closet organization, and deep dusting techniques.',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      thumbnail_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=600&fit=crop',
      cleaner_name: 'Sleep Clean Experts',
      cleaner_avatar: 'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=100&h=100&fit=crop&crop=face',
      duration: 145,
      view_count: 12890,
      like_count: 987,
      category: 'Bedroom',
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ];

  /**
   * Check if real data exists in the system
   */
  async hasRealData(): Promise<{ hasVideos: boolean; hasCleaners: boolean; hasServices: boolean }> {
    try {
      // Check for real videos from actual users (not demo data)
      const { data: videos } = await supabase
        .from('content_posts')
        .select('id')
        .eq('content_type', 'video')
        .not('user_id', 'like', 'demo-%')
        .limit(1);

      // Check for real active cleaners (not demo data)
      const { data: cleaners } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .not('id', 'like', 'demo-%')
        .not('id', 'like', 'b0c7e6a2-%') // Exclude seed data IDs
        .limit(1);

      // Check for real bookings from customers (indicates active usage)
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id')
        .not('customer_id', 'like', 'demo-%')
        .limit(1);

      return {
        hasVideos: (videos?.length || 0) > 0,
        hasCleaners: (cleaners?.length || 0) > 0,
        hasServices: (bookings?.length || 0) > 0, // Use bookings as indicator of service usage
      };
    } catch (error) {
      console.error('Error checking real data:', error);
      return { hasVideos: false, hasCleaners: false, hasServices: false };
    }
  }

  /**
   * Get videos for guest mode - always shows professional videos for demo purposes
   */
  async getGuestVideos(): Promise<GuestVideo[]> {
    try {
      // Always return professional cleaning videos for guest users
      // This ensures demo mode is always on for guests regardless of real data
      console.log('🎬 Returning professional videos for guest demo mode');
      return this.professionalVideos;
    } catch (error) {
      console.error('Error getting guest videos:', error);
      return this.professionalVideos; // Fallback to professional videos
    }
  }

  /**
   * Get enhanced video feed that includes professional videos for guests when no real data exists
   */
  async getEnhancedVideoFeed(isGuest: boolean = false): Promise<any[]> {
    try {
      // First, try to get real videos
      const realVideosResponse = await contentService.getFeed({ limit: 20 });
      const realVideos = realVideosResponse.success ? realVideosResponse.data?.posts || [] : [];

      // If we're in guest mode and there are no real videos, add professional videos
      if (isGuest && realVideos.length === 0) {
        const professionalVideos = await this.getGuestVideos();
        
        // Transform professional videos to match expected format
        return professionalVideos.map(video => ({
          id: video.id,
          title: video.title,
          description: video.description,
          video_url: video.video_url,
          thumbnail_url: video.thumbnail_url,
          user: {
            name: video.cleaner_name,
            avatar_url: video.cleaner_avatar,
          },
          duration_seconds: video.duration,
          view_count: video.view_count,
          like_count: video.like_count,
          created_at: video.created_at,
          isGuestContent: true, // Flag to identify guest content
        }));
      }

      return realVideos;
    } catch (error) {
      console.error('Error getting enhanced video feed:', error);
      return [];
    }
  }

  /**
   * Get service categories with enhanced data for guest mode
   */
  async getGuestServiceCategories(): Promise<GuestService[]> {
    try {
      const { hasServices } = await this.hasRealData();
      
      // Always show these categories, but enhance with professional imagery
      const baseCategories: GuestService[] = [
        {
          id: 'kitchen-deep-clean',
          name: 'Kitchen Deep Clean',
          description: 'Professional kitchen cleaning with degreasing, appliance cleaning, and sanitization',
          image_url: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
          rating: 4.9,
          price_range: '$80-120',
          category: 'kitchen',
        },
        {
          id: 'bathroom-deep-clean',
          name: 'Bathroom Deep Clean',
          description: 'Complete bathroom sanitization including grout cleaning and tile restoration',
          image_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop',
          rating: 4.8,
          price_range: '$60-90',
          category: 'bathroom',
        },
        {
          id: 'living-room-refresh',
          name: 'Living Room Refresh',
          description: 'Carpet cleaning, upholstery care, and complete living space organization',
          image_url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
          rating: 4.7,
          price_range: '$90-150',
          category: 'living_room',
        },
        {
          id: 'bedroom-refresh',
          name: 'Bedroom Refresh',
          description: 'Mattress cleaning, closet organization, and thorough dusting service',
          image_url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop',
          rating: 4.6,
          price_range: '$70-100',
          category: 'bedroom',
        },
      ];

      return baseCategories;
    } catch (error) {
      console.error('Error getting guest service categories:', error);
      return [];
    }
  }

  /**
   * Check if current user is a guest (not authenticated)
   */
  async isGuestUser(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 GuestModeService: Checking user auth status');
      console.log('🔍 Raw user data:', user);
      console.log('🔍 User exists:', !!user);
      console.log('🔍 User ID:', user?.id);
      console.log('🔍 User email:', user?.email);
      
      const isGuest = !user;
      console.log('🔍 Final isGuest result:', isGuest);
      return isGuest;
    } catch (error) {
      console.error('🔍 Error checking guest status:', error);
      return true; // If we can't determine, assume guest
    }
  }

  /**
   * Get cleaners for a specific service category for guest users
   */
  async getCleanersForCategory(category: string): Promise<GuestCleaner[]> {
    try {
      // First try to get real cleaners
      const realCleanersResponse = await categoryService.getCleanersBySpecialty(category);
      const realCleaners = realCleanersResponse.success ? realCleanersResponse.data : [];

      if (realCleaners.length > 0) {
        return realCleaners.map(cleaner => ({
          id: cleaner.id,
          name: cleaner.name,
          avatar_url: cleaner.avatar_url,
          rating: cleaner.rating_average,
          total_jobs: cleaner.total_jobs,
          specialties: cleaner.specialties,
          bio: cleaner.bio,
          hourly_rate: cleaner.hourly_rate,
        }));
      }

      // If no real cleaners, return sample professional cleaners
      const professionalCleaners: GuestCleaner[] = [
        {
          id: 'prof-cleaner-1',
          name: 'Sarah Professional',
          avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b754?w=100&h=100&fit=crop&crop=face',
          rating: 4.9,
          total_jobs: 420,
          specialties: [category, 'Deep Cleaning', 'Eco-Friendly'],
          bio: `Professional ${category.toLowerCase()} cleaning specialist with 5+ years experience.`,
          hourly_rate: 35,
        },
        {
          id: 'prof-cleaner-2',
          name: 'Mike Expert',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
          rating: 4.8,
          total_jobs: 312,
          specialties: [category, 'Professional Grade', 'Fast Service'],
          bio: `Certified ${category.toLowerCase()} cleaning expert using professional equipment.`,
          hourly_rate: 32,
        },
        {
          id: 'prof-cleaner-3',
          name: 'Emma Specialist',
          avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
          rating: 4.7,
          total_jobs: 258,
          specialties: [category, 'Organic Products', 'Detail Oriented'],
          bio: `${category} cleaning specialist focused on health-safe, thorough cleaning.`,
          hourly_rate: 30,
        },
      ];

      return professionalCleaners;
    } catch (error) {
      console.error('Error getting cleaners for category:', error);
      return [];
    }
  }
}

export const guestModeService = new GuestModeService();
