/**
 * Content Analytics Service
 * 
 * Provides analytics for cleaner video content:
 * - Total views across all videos
 * - Bookings generated from videos
 * - Conversion rate (bookings / views)
 * - Average views per video
 * - Individual video performance
 */

import { supabase } from './supabase';

export interface ContentPost {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  content_type: 'video' | 'photo' | 'before_after';
  media_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  view_count: number;
  like_count: number;
  share_count: number;
  comment_count: number;
}

export interface ContentAnalytics {
  id: string;
  title: string;
  content_type: string;
  media_url: string;
  thumbnail_url: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  view_count: number;
  like_count: number;
  share_count: number;
  comment_count: number;
  bookings_generated: number;
  revenue_generated: number;
  conversion_rate: number;
}

export interface ContentPerformanceSummary {
  totalViews: number;
  totalBookings: number;
  totalRevenue: number;
  conversionRate: number;
  avgViewsPerVideo: number;
  videoCount: number;
}

export interface VideoWithStats {
  id: string;
  uri: string;
  title: string;
  description: string | null;
  duration: number;
  uploadDate: string;
  status: 'uploading' | 'processing' | 'live' | 'failed';
  views: number;
  likes: number;
  shares: number;
  comments: number;
  bookings: number;
  revenue: number;
  conversionRate: number;
  thumbnailUrl: string | null;
}

class ContentAnalyticsService {
  /**
   * Get all content posts for a user with their analytics
   */
  async getUserContent(userId: string): Promise<ContentPost[]> {
    try {
      const { data, error } = await supabase
        .from('content_posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching user content:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('❌ Error in getUserContent:', err);
      return [];
    }
  }

  /**
   * Get content analytics from the view (includes booking attribution)
   */
  async getContentAnalytics(userId: string): Promise<ContentAnalytics[]> {
    try {
      // First try the analytics view
      const { data: viewData, error: viewError } = await supabase
        .from('content_analytics')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!viewError && viewData) {
        return viewData;
      }

      // Fallback: manually calculate if view doesn't exist
      console.log('⚠️ content_analytics view not available, falling back to manual calculation');
      
      const { data: posts, error: postsError } = await supabase
        .from('content_posts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (postsError || !posts) {
        console.error('❌ Error fetching posts:', postsError);
        return [];
      }

      // Get bookings for each post
      const analyticsPromises = posts.map(async (post) => {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('id, total_amount')
          .eq('source_content_id', post.id)
          .in('status', ['confirmed', 'in_progress', 'completed']);

        const bookingsGenerated = bookings?.length || 0;
        const revenueGenerated = bookings?.reduce((sum, b) => sum + (parseFloat(b.total_amount) || 0), 0) || 0;
        const conversionRate = post.view_count > 0 
          ? Math.round((bookingsGenerated / post.view_count) * 10000) / 100 
          : 0;

        return {
          ...post,
          bookings_generated: bookingsGenerated,
          revenue_generated: revenueGenerated,
          conversion_rate: conversionRate,
        } as ContentAnalytics;
      });

      return Promise.all(analyticsPromises);
    } catch (err) {
      console.error('❌ Error in getContentAnalytics:', err);
      return [];
    }
  }

  /**
   * Get performance summary for a user's content
   */
  async getPerformanceSummary(userId: string): Promise<ContentPerformanceSummary> {
    try {
      const analytics = await this.getContentAnalytics(userId);

      if (analytics.length === 0) {
        return {
          totalViews: 0,
          totalBookings: 0,
          totalRevenue: 0,
          conversionRate: 0,
          avgViewsPerVideo: 0,
          videoCount: 0,
        };
      }

      const totalViews = analytics.reduce((sum, a) => sum + (a.view_count || 0), 0);
      const totalBookings = analytics.reduce((sum, a) => sum + (a.bookings_generated || 0), 0);
      const totalRevenue = analytics.reduce((sum, a) => sum + (a.revenue_generated || 0), 0);
      const videoCount = analytics.length;
      const avgViewsPerVideo = videoCount > 0 ? Math.round(totalViews / videoCount) : 0;
      const conversionRate = totalViews > 0 
        ? Math.round((totalBookings / totalViews) * 10000) / 100 
        : 0;

      return {
        totalViews,
        totalBookings,
        totalRevenue,
        conversionRate,
        avgViewsPerVideo,
        videoCount,
      };
    } catch (err) {
      console.error('❌ Error in getPerformanceSummary:', err);
      return {
        totalViews: 0,
        totalBookings: 0,
        totalRevenue: 0,
        conversionRate: 0,
        avgViewsPerVideo: 0,
        videoCount: 0,
      };
    }
  }

  /**
   * Get videos with stats formatted for the VideoUploadScreen
   */
  async getVideosWithStats(userId: string): Promise<VideoWithStats[]> {
    try {
      const analytics = await this.getContentAnalytics(userId);

      return analytics
        .filter(a => a.content_type === 'video')
        .map(a => ({
          id: a.id,
          uri: a.media_url,
          title: a.title,
          description: null,
          duration: 0, // Would need to store this
          uploadDate: a.published_at 
            ? new Date(a.published_at).toISOString().split('T')[0]
            : new Date(a.created_at).toISOString().split('T')[0],
          status: a.status === 'published' ? 'live' as const : 'processing' as const,
          views: a.view_count || 0,
          likes: a.like_count || 0,
          shares: a.share_count || 0,
          comments: a.comment_count || 0,
          bookings: a.bookings_generated || 0,
          revenue: a.revenue_generated || 0,
          conversionRate: a.conversion_rate || 0,
          thumbnailUrl: a.thumbnail_url,
        }));
    } catch (err) {
      console.error('❌ Error in getVideosWithStats:', err);
      return [];
    }
  }

  /**
   * Record a view for a content post
   */
  async recordView(contentId: string, userId: string): Promise<boolean> {
    try {
      // Check if user already viewed this content
      const { data: existing } = await supabase
        .from('content_interactions')
        .select('id')
        .eq('user_id', userId)
        .eq('content_post_id', contentId)
        .eq('interaction_type', 'view')
        .single();

      if (existing) {
        // Already viewed
        return true;
      }

      const { error } = await supabase
        .from('content_interactions')
        .insert({
          user_id: userId,
          content_post_id: contentId,
          interaction_type: 'view',
        });

      if (error) {
        console.error('❌ Error recording view:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('❌ Error in recordView:', err);
      return false;
    }
  }

  /**
   * Track booking attribution - call this when a booking is created from watching content
   */
  async attributeBooking(bookingId: string, contentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ source_content_id: contentId })
        .eq('id', bookingId);

      if (error) {
        console.error('❌ Error attributing booking:', error);
        return false;
      }

      console.log(`✅ Attributed booking ${bookingId} to content ${contentId}`);
      return true;
    } catch (err) {
      console.error('❌ Error in attributeBooking:', err);
      return false;
    }
  }
}

export const contentAnalyticsService = new ContentAnalyticsService();


