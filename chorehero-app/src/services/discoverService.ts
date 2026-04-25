/**
 * Discover service.
 *
 * Wraps the SQL primitives added in migration 077:
 *   - get_recommended_cleaners (proximity + rating + verified + recency)
 *   - get_trending_cleaners    (last-7-day content engagement, near you)
 *   - services where coming_soon = true
 *   - service_interest_signups insert (for the "Notify me" CTA)
 *
 * Deliberately small — the previous Discover code reached straight into
 * Supabase from the screen, which is why empty states and personalization
 * lagged. Centralizing it here lets the screen stay declarative.
 */

import { supabase } from './supabase';

export interface RecommendedCleaner {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  rating_average: number | null;
  total_jobs: number | null;
  hourly_rate: number | null;
  service_radius_km: number | null;
  distance_miles: number | null;
  verification_status: string | null;
  is_available: boolean;
  recommendation_score: number | null;
}

export interface TrendingCleaner {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  rating_average: number | null;
  total_jobs: number | null;
  hourly_rate: number | null;
  trending_score: number;
  view_count: number;
  like_count: number;
  distance_miles: number | null;
}

export interface ComingSoonService {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
}

class DiscoverService {
  async getRecommendedCleaners(params: {
    lat?: number;
    lng?: number;
    userId?: string;
    radiusMiles?: number;
    limit?: number;
  }): Promise<RecommendedCleaner[]> {
    try {
      const { data, error } = await supabase.rpc('get_recommended_cleaners', {
        p_lat: params.lat ?? null,
        p_lng: params.lng ?? null,
        p_user_id: params.userId ?? null,
        p_radius_miles: params.radiusMiles ?? 50,
        p_limit: params.limit ?? 10,
      });
      if (error) {
        console.warn('get_recommended_cleaners failed:', error.message);
        return [];
      }
      return (data || []) as RecommendedCleaner[];
    } catch (e) {
      console.warn('getRecommendedCleaners threw:', e);
      return [];
    }
  }

  async getTrendingCleaners(params: {
    lat?: number;
    lng?: number;
    radiusMiles?: number;
    limit?: number;
  }): Promise<TrendingCleaner[]> {
    try {
      const { data, error } = await supabase.rpc('get_trending_cleaners', {
        p_lat: params.lat ?? null,
        p_lng: params.lng ?? null,
        p_radius_miles: params.radiusMiles ?? 50,
        p_limit: params.limit ?? 10,
      });
      if (error) {
        console.warn('get_trending_cleaners failed:', error.message);
        return [];
      }
      return (data || []) as TrendingCleaner[];
    } catch (e) {
      console.warn('getTrendingCleaners threw:', e);
      return [];
    }
  }

  async getComingSoonServices(): Promise<ComingSoonService[]> {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, slug, name, description, category, icon')
        .eq('coming_soon', true)
        .eq('is_active', true)
        .order('name', { ascending: true });
      if (error) {
        console.warn('getComingSoonServices failed:', error.message);
        return [];
      }
      return (data || []) as ComingSoonService[];
    } catch (e) {
      console.warn('getComingSoonServices threw:', e);
      return [];
    }
  }

  /**
   * Register a customer's interest in a coming-soon service. Idempotent on
   * the server (UNIQUE constraint), so callers can fire-and-forget.
   */
  async signUpForServiceInterest(params: {
    userId: string;
    serviceId: string;
    zipCode?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from('service_interest_signups').insert({
        user_id: params.userId,
        service_id: params.serviceId,
        zip_code: params.zipCode ?? null,
      });
      if (error) {
        // Duplicate key is fine — the user is already on the list.
        if (error.code === '23505') {
          return { success: true };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Failed to sign up',
      };
    }
  }
}

export const discoverService = new DiscoverService();
