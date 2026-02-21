/**
 * Enhanced Video Feed Algorithm Service
 * Implements intelligent content ranking for optimal user experience
 */

import { supabase } from './supabase';
import { contentService } from './contentService';
import { userStatsService } from './userStatsService';

export interface FeedRankingFactors {
  proximity: number;          // 0-1 based on distance
  engagement: number;         // likes, views, comments ratio
  recency: number;           // how recent the content is
  personalInteraction: number; // user's past interactions with this cleaner
  serviceRelevance: number;   // matches user's booking history/preferences
  cleanerRating: number;      // cleaner's overall rating
  availability: number;       // cleaner's current availability
  priceMatch: number;         // matches user's budget range
}

export interface EnhancedVideoItem {
  id: string;
  cleaner_id: string;
  title: string;
  description: string;
  media_url: string;
  thumbnail_url: string;
  
  // Package pricing (from content_posts when is_bookable)
  base_price_cents?: number | null;
  package_type?: 'fixed' | 'estimate' | 'hourly' | null;
  is_bookable?: boolean | null;
  estimated_hours?: number | null;
  
  // Enhanced ranking data
  ranking_score: number;
  ranking_factors: FeedRankingFactors;
  
  // Content metrics
  view_count: number;
  like_count: number;
  comment_count: number;
  
  // Cleaner data
  cleaner: {
    id: string;
    name: string;
    avatar_url: string;
    rating_average: number;
    hourly_rate: number;
    is_available: boolean;
    total_jobs?: number;
    distance_km: number;
    specialties: string[];
  };
  
  created_at: string;
}

class VideoFeedAlgorithmService {
  
  /**
   * Get intelligently ranked video feed for user.
   * Tries server-side RPC (get_ranked_cleaner_feed) when location is available for scale.
   */
  async getRankedFeed(
    userId: string,
    userLocation?: { latitude: number; longitude: number },
    options: {
      limit?: number;
      sort_preference?: 'balanced' | 'proximity' | 'engagement' | 'price';
      service_filter?: string[];
      budget_range?: { min: number; max: number };
    } = {}
  ): Promise<EnhancedVideoItem[]> {
    const { limit = 20, sort_preference = 'balanced' } = options;

    try {
      // Try server-side RPC first when we have location (better for scale)
      if (userLocation?.latitude != null && userLocation?.longitude != null) {
        let rpcItems = await this.getRankedFeedFromRpc(
          userLocation.latitude,
          userLocation.longitude,
          limit,
          false
        );
        // Cold start: if no verified cleaners, broaden to include unverified (launch day)
        if (rpcItems.length === 0) {
          rpcItems = await this.getRankedFeedFromRpc(
            userLocation.latitude,
            userLocation.longitude,
            limit,
            true
          );
        }
        if (rpcItems.length > 0) return rpcItems;
      }

      // Fallback: client-side ranking
      const userProfile = await this.getUserPreferences(userId);
      const rawContent = await this.getRawContentWithCleaners(userLocation, limit * 2);
      const rankedContent = await Promise.all(
        rawContent.map((item) =>
          this.calculateRankingScore(item, userId, userProfile, userLocation, sort_preference)
        )
      );
      return rankedContent
        .sort((a, b) => b.ranking_score - a.ranking_score)
        .slice(0, limit);
    } catch (error) {
      console.error('Error in getRankedFeed:', error);
      return [];
    }
  }

  /**
   * Server-side ranked feed via RPC (scales better than client-side).
   * @param includeUnverified - when true, show unverified cleaners (cold start / launch day)
   */
  private async getRankedFeedFromRpc(
    lat: number,
    lng: number,
    limit: number,
    includeUnverified = false
  ): Promise<EnhancedVideoItem[]> {
    try {
      const { data: rows, error } = await supabase.rpc('get_ranked_cleaner_feed', {
        p_lat: lat,
        p_lng: lng,
        p_radius_km: 50,
        p_limit: limit,
        p_include_unverified: includeUnverified,
      });

      if (error || !rows?.length) return [];

      const contentIds = rows.map((r: { content_id: string }) => r.content_id);
      const rankMap = new Map(rows.map((r: { content_id: string; rank_score: number }) => [r.content_id, r.rank_score]));
      const distanceMap = new Map(rows.map((r: { content_id: string; distance_km?: number | null }) => [r.content_id, r.distance_km ?? null]));

      const { data: posts } = await supabase
        .from('content_posts')
        .select(
          `
          id,
          user_id,
          title,
          description,
          media_url,
          thumbnail_url,
          view_count,
          like_count,
          comment_count,
          created_at,
          base_price_cents,
          package_type,
          is_bookable,
          estimated_hours,
          user:users(id, name, avatar_url, cleaner_profiles(rating_average, hourly_rate, is_available, total_jobs))
        `
        )
        .in('id', contentIds);

      if (!posts?.length) return [];

      const ordered = contentIds
        .map((id) => posts.find((p) => p.id === id))
        .filter(Boolean) as typeof posts;

      return ordered.map((p) => {
        const cp = p.user?.cleaner_profiles as { rating_average?: number; hourly_rate?: number; is_available?: boolean; total_jobs?: number } | undefined;
        const post = p as { base_price_cents?: number | null; package_type?: string | null; is_bookable?: boolean | null; estimated_hours?: number | null };
        return {
          id: p.id,
          cleaner_id: p.user_id,
          title: p.title || '',
          description: p.description || '',
          media_url: p.media_url,
          thumbnail_url: p.thumbnail_url || '',
          base_price_cents: post.base_price_cents ?? null,
          package_type: post.package_type ?? null,
          is_bookable: post.is_bookable ?? null,
          estimated_hours: post.estimated_hours ?? null,
          ranking_score: rankMap.get(p.id) ?? 0,
          ranking_factors: {} as FeedRankingFactors,
          view_count: p.view_count ?? 0,
          like_count: p.like_count ?? 0,
          comment_count: p.comment_count ?? 0,
          cleaner: {
            id: p.user_id,
            name: (p.user as { name?: string })?.name || 'Provider',
            avatar_url: (p.user as { avatar_url?: string })?.avatar_url || '',
            rating_average: cp?.rating_average ?? 0,
            hourly_rate: cp?.hourly_rate ?? 0,
            is_available: cp?.is_available ?? true,
            total_jobs: cp?.total_jobs ?? 0,
            distance_km: distanceMap.get(p.id) ?? 0,
            specialties: [],
          },
          created_at: p.created_at || new Date().toISOString(),
        };
      });
    } catch {
      return [];
    }
  }
  
  /**
   * Calculate comprehensive ranking score for a video
   */
  private async calculateRankingScore(
    item: any,
    userId: string,
    userProfile: any,
    userLocation?: { latitude: number; longitude: number },
    sortPreference: string = 'balanced'
  ): Promise<EnhancedVideoItem> {
    
    const factors: FeedRankingFactors = {
      proximity: this.calculateProximityScore(item.cleaner, userLocation),
      engagement: this.calculateEngagementScore(item),
      recency: this.calculateRecencyScore(item.created_at),
      personalInteraction: await this.calculatePersonalInteractionScore(userId, item.cleaner.id),
      serviceRelevance: this.calculateServiceRelevanceScore(item.cleaner, userProfile),
      cleanerRating: this.calculateRatingScore(item.cleaner.rating_average),
      availability: this.calculateAvailabilityScore(item.cleaner.is_available),
      priceMatch: this.calculatePriceMatchScore(item.cleaner.hourly_rate, userProfile.budget_range)
    };
    
    // Weight factors based on sort preference
    const weights = this.getWeights(sortPreference);
    
    const ranking_score = 
      (factors.proximity * weights.proximity) +
      (factors.engagement * weights.engagement) +
      (factors.recency * weights.recency) +
      (factors.personalInteraction * weights.personalInteraction) +
      (factors.serviceRelevance * weights.serviceRelevance) +
      (factors.cleanerRating * weights.cleanerRating) +
      (factors.availability * weights.availability) +
      (factors.priceMatch * weights.priceMatch);
    
    return {
      ...item,
      ranking_score,
      ranking_factors: factors
    };
  }
  
  /**
   * Get ranking weights based on user preference
   */
  private getWeights(sortPreference: string) {
    const weights = {
      balanced: {
        proximity: 0.25,
        engagement: 0.15,
        recency: 0.15,
        personalInteraction: 0.1,
        serviceRelevance: 0.15,
        cleanerRating: 0.1,
        availability: 0.05,
        priceMatch: 0.05
      },
      proximity: {
        proximity: 0.4,
        engagement: 0.1,
        recency: 0.1,
        personalInteraction: 0.1,
        serviceRelevance: 0.1,
        cleanerRating: 0.1,
        availability: 0.05,
        priceMatch: 0.05
      },
      engagement: {
        proximity: 0.15,
        engagement: 0.3,
        recency: 0.2,
        personalInteraction: 0.15,
        serviceRelevance: 0.1,
        cleanerRating: 0.05,
        availability: 0.03,
        priceMatch: 0.02
      },
      price: {
        proximity: 0.2,
        engagement: 0.1,
        recency: 0.1,
        personalInteraction: 0.1,
        serviceRelevance: 0.15,
        cleanerRating: 0.1,
        availability: 0.05,
        priceMatch: 0.2
      }
    };
    
    return weights[sortPreference] || weights.balanced;
  }
  
  /**
   * Calculate proximity score (0-1, higher is better)
   */
  private calculateProximityScore(cleaner: any, userLocation?: { latitude: number; longitude: number }): number {
    if (!userLocation || !cleaner.latitude || !cleaner.longitude) return 0.5; // neutral if no location
    
    const distance = this.calculateDistance(
      userLocation.latitude, 
      userLocation.longitude,
      cleaner.latitude, 
      cleaner.longitude
    );
    
    // Score decreases with distance, max score at 0km, min score at 50km+
    return Math.max(0, Math.min(1, (50 - distance) / 50));
  }
  
  /**
   * Calculate engagement score based on views, likes, comments
   */
  private calculateEngagementScore(item: any): number {
    const { view_count = 0, like_count = 0, comment_count = 0 } = item;
    
    // Calculate engagement rate
    const likeRate = view_count > 0 ? like_count / view_count : 0;
    const commentRate = view_count > 0 ? comment_count / view_count : 0;
    
    // Weight different types of engagement
    const engagementScore = (likeRate * 0.6) + (commentRate * 0.4);
    
    // Normalize to 0-1 scale (assuming max 10% engagement rate is excellent)
    return Math.min(1, engagementScore / 0.1);
  }
  
  /**
   * Calculate recency score (fresher content scores higher)
   */
  private calculateRecencyScore(createdAt: string): number {
    const now = new Date();
    const created = new Date(createdAt);
    const hoursSinceCreated = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    
    // Score decreases over time, max score for content < 24h old
    if (hoursSinceCreated <= 24) return 1;
    if (hoursSinceCreated <= 168) return 0.8; // 1 week
    if (hoursSinceCreated <= 720) return 0.6; // 1 month
    return 0.4; // older content
  }
  
  /**
   * Calculate personal interaction score with this cleaner
   */
  private async calculatePersonalInteractionScore(userId: string, cleanerId: string): Promise<number> {
    try {
      // Check for previous bookings
      const { data: bookings } = await supabase
        .from('bookings')
        .select('rating_given')
        .eq('customer_id', userId)
        .eq('cleaner_id', cleanerId);
      
      if (bookings && bookings.length > 0) {
        // Has booked before - high score
        const avgRating = bookings.reduce((sum, b) => sum + (b.rating_given || 0), 0) / bookings.length;
        return Math.min(1, avgRating / 5); // normalize 5-star rating to 0-1
      }
      
      // Check for content interactions
      const { data: interactions } = await supabase
        .from('content_interactions')
        .select('interaction_type')
        .eq('user_id', userId)
        .eq('cleaner_id', cleanerId);
      
      if (interactions && interactions.length > 0) {
        return 0.3; // Has interacted with content
      }
      
      return 0; // No previous interaction
      
    } catch (error) {
      console.error('Error calculating personal interaction score:', error);
      return 0;
    }
  }
  
  /**
   * Calculate service relevance based on user's booking history and preferences
   */
  private calculateServiceRelevanceScore(cleaner: any, userProfile: any): number {
    if (!cleaner.specialties || !userProfile.preferred_services) return 0.5;
    
    const cleanerServices = new Set(cleaner.specialties);
    const userPreferences = new Set(userProfile.preferred_services);
    
    // Calculate overlap
    const intersection = new Set([...cleanerServices].filter(x => userPreferences.has(x)));
    const overlap = intersection.size / Math.max(userPreferences.size, 1);
    
    return Math.min(1, overlap);
  }
  
  /**
   * Calculate rating score
   */
  private calculateRatingScore(rating: number): number {
    if (!rating) return 0.5;
    return Math.min(1, rating / 5); // normalize 5-star to 0-1
  }
  
  /**
   * Calculate availability score
   */
  private calculateAvailabilityScore(isAvailable: boolean): number {
    return isAvailable ? 1 : 0.3; // Available cleaners get priority
  }
  
  /**
   * Calculate price match score
   */
  private calculatePriceMatchScore(hourlyRate: number, userBudgetRange?: { min: number; max: number }): number {
    if (!userBudgetRange || !hourlyRate) return 0.5;
    
    const { min, max } = userBudgetRange;
    
    if (hourlyRate >= min && hourlyRate <= max) return 1; // Perfect match
    if (hourlyRate < min) return 0.8; // Under budget (good)
    
    // Over budget - score decreases with how much over
    const overBudgetRatio = (hourlyRate - max) / max;
    return Math.max(0, 1 - (overBudgetRatio * 2));
  }
  
  /**
   * Get user preferences and booking history
   */
  private async getUserPreferences(userId: string): Promise<any> {
    try {
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      const { data: bookingHistory } = await supabase
        .from('bookings')
        .select('service_type, cleaner_rating')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      // Extract preferences from booking history
      const serviceFrequency = {};
      bookingHistory?.forEach(booking => {
        serviceFrequency[booking.service_type] = (serviceFrequency[booking.service_type] || 0) + 1;
      });
      
      const preferred_services = Object.keys(serviceFrequency)
        .sort((a, b) => serviceFrequency[b] - serviceFrequency[a])
        .slice(0, 3);
      
      return {
        ...profile,
        preferred_services,
        booking_count: bookingHistory?.length || 0
      };
      
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return { preferred_services: [], booking_count: 0 };
    }
  }
  
  /**
   * Get raw content with cleaner data
   */
  private async getRawContentWithCleaners(
    userLocation?: { latitude: number; longitude: number },
    limit: number = 40
  ): Promise<any[]> {
    try {
      const { data: posts } = await supabase
        .from('content_posts')
        .select(`
          *,
          cleaner:users!content_posts_user_id_fkey (
            id,
            name,
            avatar_url,
            cleaner_profiles (
              rating_average,
              hourly_rate,
              is_available,
              specialties,
              latitude,
              longitude
            )
          )
        `)
        .eq('users.role', 'cleaner')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      return posts || [];
      
    } catch (error) {
      console.error('Error getting raw content:', error);
      return [];
    }
  }
  
  /**
   * Calculate distance between two points
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  private toRad(deg: number): number {
    return deg * (Math.PI/180);
  }
}

export const videoFeedAlgorithmService = new VideoFeedAlgorithmService();
