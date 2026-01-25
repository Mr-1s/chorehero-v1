import { supabase } from './supabase';

export type ExploreSortOrder = 'rating' | 'price' | 'distance';

export interface ExploreFilters {
  service_tags?: string[];
  price_range?: [number, number];
}

export interface ExploreQuery {
  query: string;
  filters: ExploreFilters;
  sort_by: ExploreSortOrder;
  limit: number;
}

export interface ExploreProviderRow {
  provider_id: string;
  provider_name: string;
  provider_avatar_url: string | null;
  avg_rating: number | null;
  response_time_minutes: number | null;
  completion_rate: number | null;
  price_tiers: number[];
}

class ExploreService {
  async searchProviders(input: ExploreQuery): Promise<{ success: boolean; data?: ExploreProviderRow[]; error?: string }> {
    try {
      const { query, filters, sort_by, limit } = input;
      const priceMin = filters.price_range ? filters.price_range[0] : null;
      const priceMax = filters.price_range ? filters.price_range[1] : null;

      const { data, error } = await supabase.rpc('explore_providers', {
        query_text: query,
        filter_service_tags: filters.service_tags || null,
        price_min: priceMin,
        price_max: priceMax,
        sort_by,
        limit_count: limit,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: (data as ExploreProviderRow[]) || [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Explore search failed' };
    }
  }
}

export const exploreService = new ExploreService();
