import { supabase } from './supabase';
import { guestModeService } from './guestModeService';

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  image_url: string;
  rating: number;
  price_range: string;
  category: string;
  cleaner_count?: number;
  average_completion_time?: string;
}

export interface CleanerProfile {
  id: string;
  name: string;
  avatar_url: string;
  rating_average: number;
  total_jobs: number;
  hourly_rate: number;
  bio: string;
  specialties: string[];
  verification_status: 'verified' | 'pending' | 'unverified';
  is_available: boolean;
  service_radius_km: number;
  video_profile_url?: string;
  response_time_minutes?: number;
  next_available?: string;
}

class ServiceDiscoveryService {
  /**
   * Get service categories populated with real cleaner data
   * Falls back to guest mode data if no real cleaners available
   */
  async getServiceCategories(): Promise<{ success: boolean; data?: ServiceCategory[]; error?: string }> {
    try {
      console.log('🔍 Loading real service categories...');

      // Check if we have real cleaners in the database
      const { data: cleaners, error: cleanersError } = await supabase
        .from('users')
        .select(`
          id,
          profile:user_profiles(
            specialties,
            hourly_rate,
            rating_average,
            total_jobs,
            verification_status
          )
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .not('id', 'like', 'demo_%'); // Exclude demo accounts

      if (cleanersError) {
        console.warn('Error fetching cleaners:', cleanersError);
        return this.getFallbackServiceCategories();
      }

      // If no real cleaners, return guest mode data
      if (!cleaners || cleaners.length === 0) {
        console.log('📋 No real cleaners found, using guest mode service categories');
        return this.getFallbackServiceCategories();
      }

      // Process real cleaner data to create service categories
      const specialtyStats = this.calculateSpecialtyStats(cleaners);
      const realCategories = this.createServiceCategoriesFromCleaners(specialtyStats);

      console.log(`✅ Found ${cleaners.length} real cleaners, created ${realCategories.length} service categories`);
      return { success: true, data: realCategories };

    } catch (error) {
      console.error('❌ Error loading service categories:', error);
      return this.getFallbackServiceCategories();
    }
  }

  /**
   * Get cleaners for a specific service category
   */
  async getCleanersForCategory(category: string, location?: { latitude: number; longitude: number }): Promise<{ success: boolean; data?: CleanerProfile[]; error?: string }> {
    try {
      console.log('🔍 Finding cleaners for category:', category);

      // Query cleaners with specialties matching the category
      let query = supabase
        .from('users')
        .select(`
          id,
          name,
          avatar_url,
          profile:user_profiles(
            hourly_rate,
            rating_average,
            total_jobs,
            bio,
            specialties,
            verification_status,
            is_available,
            service_radius_km,
            video_profile_url
          )
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true);

      // Filter by specialty if specific category provided
      if (category && category !== 'all') {
        query = query.contains('profile.specialties', [category]);
      }

      const { data: cleaners, error } = await query.limit(20);

      if (error) {
        throw error;
      }

      if (!cleaners || cleaners.length === 0) {
        // No real cleaners found, return guest mode cleaners
        console.log('📋 No real cleaners found for category, using guest mode');
        const guestCleaners = await guestModeService.getCleanersForCategory(category);
        return { success: true, data: guestCleaners.map(this.mapGuestToCleanerProfile) };
      }

      // Transform database results to CleanerProfile format
      const cleanerProfiles: CleanerProfile[] = cleaners.map(cleaner => ({
        id: cleaner.id,
        name: cleaner.name,
        avatar_url: cleaner.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
        rating_average: cleaner.profile?.rating_average || 4.5,
        total_jobs: cleaner.profile?.total_jobs || 0,
        hourly_rate: cleaner.profile?.hourly_rate || 25,
        bio: cleaner.profile?.bio || 'Professional cleaning service provider.',
        specialties: cleaner.profile?.specialties || [category],
        verification_status: cleaner.profile?.verification_status || 'pending',
        is_available: cleaner.profile?.is_available || true,
        service_radius_km: cleaner.profile?.service_radius_km || 25,
        video_profile_url: cleaner.profile?.video_profile_url,
      }));

      console.log(`✅ Found ${cleanerProfiles.length} cleaners for category: ${category}`);
      return { success: true, data: cleanerProfiles };

    } catch (error) {
      console.error('❌ Error getting cleaners for category:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cleaners'
      };
    }
  }

  /**
   * Search for cleaners by various criteria
   */
  async searchCleaners(params: {
    query?: string;
    specialties?: string[];
    maxHourlyRate?: number;
    minRating?: number;
    location?: { latitude: number; longitude: number; radius?: number };
    availableNow?: boolean;
  }): Promise<{ success: boolean; data?: CleanerProfile[]; error?: string }> {
    try {
      console.log('🔍 Searching cleaners with params:', params);

      let query = supabase
        .from('users')
        .select(`
          id,
          name,
          avatar_url,
          profile:user_profiles(
            hourly_rate,
            rating_average,
            total_jobs,
            bio,
            specialties,
            verification_status,
            is_available,
            service_radius_km,
            video_profile_url
          )
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true);

      // Apply filters
      if (params.query) {
        query = query.ilike('name', `%${params.query}%`);
      }

      if (params.maxHourlyRate) {
        query = query.lte('profile.hourly_rate', params.maxHourlyRate);
      }

      if (params.minRating) {
        query = query.gte('profile.rating_average', params.minRating);
      }

      if (params.availableNow) {
        query = query.eq('profile.is_available', true);
      }

      const { data: cleaners, error } = await query.limit(50);

      if (error) {
        throw error;
      }

      // Filter by specialties if provided
      let filteredCleaners = cleaners || [];
      if (params.specialties && params.specialties.length > 0) {
        filteredCleaners = filteredCleaners.filter(cleaner => 
          params.specialties!.some(specialty => 
            cleaner.profile?.specialties?.includes(specialty)
          )
        );
      }

      const cleanerProfiles: CleanerProfile[] = filteredCleaners.map(cleaner => ({
        id: cleaner.id,
        name: cleaner.name,
        avatar_url: cleaner.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
        rating_average: cleaner.profile?.rating_average || 4.5,
        total_jobs: cleaner.profile?.total_jobs || 0,
        hourly_rate: cleaner.profile?.hourly_rate || 25,
        bio: cleaner.profile?.bio || 'Professional cleaning service provider.',
        specialties: cleaner.profile?.specialties || ['Standard Cleaning'],
        verification_status: cleaner.profile?.verification_status || 'pending',
        is_available: cleaner.profile?.is_available || true,
        service_radius_km: cleaner.profile?.service_radius_km || 25,
        video_profile_url: cleaner.profile?.video_profile_url,
      }));

      console.log(`✅ Search returned ${cleanerProfiles.length} cleaners`);
      return { success: true, data: cleanerProfiles };

    } catch (error) {
      console.error('❌ Error searching cleaners:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search cleaners'
      };
    }
  }

  /**
   * Get featured cleaners for the home/discover page
   */
  async getFeaturedCleaners(limit: number = 6): Promise<{ success: boolean; data?: CleanerProfile[]; error?: string }> {
    try {
      const { data: cleaners, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          avatar_url,
          profile:user_profiles(
            hourly_rate,
            rating_average,
            total_jobs,
            bio,
            specialties,
            verification_status,
            is_available,
            service_radius_km,
            video_profile_url
          )
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .eq('profile.verification_status', 'verified')
        .gte('profile.rating_average', 4.5)
        .order('profile.total_jobs', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      if (!cleaners || cleaners.length === 0) {
        // Return guest mode featured cleaners as fallback
        const guestCleaners = await guestModeService.getCleanersForCategory('featured');
        return { 
          success: true, 
          data: guestCleaners.slice(0, limit).map(this.mapGuestToCleanerProfile)
        };
      }

      const featuredCleaners: CleanerProfile[] = cleaners.map(cleaner => ({
        id: cleaner.id,
        name: cleaner.name,
        avatar_url: cleaner.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
        rating_average: cleaner.profile?.rating_average || 4.5,
        total_jobs: cleaner.profile?.total_jobs || 0,
        hourly_rate: cleaner.profile?.hourly_rate || 25,
        bio: cleaner.profile?.bio || 'Professional cleaning service provider.',
        specialties: cleaner.profile?.specialties || ['Professional Cleaning'],
        verification_status: cleaner.profile?.verification_status || 'verified',
        is_available: cleaner.profile?.is_available || true,
        service_radius_km: cleaner.profile?.service_radius_km || 25,
        video_profile_url: cleaner.profile?.video_profile_url,
      }));

      return { success: true, data: featuredCleaners };

    } catch (error) {
      console.error('❌ Error getting featured cleaners:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get featured cleaners'
      };
    }
  }

  // Private helper methods

  private async getFallbackServiceCategories(): Promise<{ success: boolean; data: ServiceCategory[] }> {
    const guestCategories = await guestModeService.getGuestServiceCategories();
    return { success: true, data: guestCategories };
  }

  private calculateSpecialtyStats(cleaners: any[]): Record<string, { count: number; avgRate: number; avgRating: number }> {
    const stats: Record<string, { count: number; totalRate: number; totalRating: number; ratingCount: number }> = {};

    cleaners.forEach(cleaner => {
      const specialties = cleaner.profile?.specialties || [];
      const rate = cleaner.profile?.hourly_rate || 25;
      const rating = cleaner.profile?.rating_average || 0;

      specialties.forEach((specialty: string) => {
        if (!stats[specialty]) {
          stats[specialty] = { count: 0, totalRate: 0, totalRating: 0, ratingCount: 0 };
        }
        stats[specialty].count++;
        stats[specialty].totalRate += rate;
        if (rating > 0) {
          stats[specialty].totalRating += rating;
          stats[specialty].ratingCount++;
        }
      });
    });

    // Convert to averages
    const result: Record<string, { count: number; avgRate: number; avgRating: number }> = {};
    Object.entries(stats).forEach(([specialty, data]) => {
      result[specialty] = {
        count: data.count,
        avgRate: Math.round(data.totalRate / data.count),
        avgRating: data.ratingCount > 0 ? data.totalRating / data.ratingCount : 4.5,
      };
    });

    return result;
  }

  private createServiceCategoriesFromCleaners(specialtyStats: Record<string, { count: number; avgRate: number; avgRating: number }>): ServiceCategory[] {
    const categoryMappings: Record<string, { name: string; description: string; image: string }> = {
      'Deep Cleaning': {
        name: 'Deep Clean Service',
        description: 'Comprehensive deep cleaning with professional equipment',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
      },
      'Standard Cleaning': {
        name: 'Standard Clean',
        description: 'Regular house cleaning and maintenance',
        image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop'
      },
      'Kitchen': {
        name: 'Kitchen Deep Clean',
        description: 'Professional kitchen cleaning with degreasing and sanitization',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
      },
      'Bathroom': {
        name: 'Bathroom Deep Clean',
        description: 'Complete bathroom sanitization including grout restoration',
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop'
      },
      'Living Room': {
        name: 'Living Room Refresh',
        description: 'Carpet cleaning, upholstery care, and complete living space organization',
        image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop'
      },
      'Bedroom': {
        name: 'Bedroom Refresh',
        description: 'Mattress cleaning, closet organization, and thorough dusting service',
        image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop'
      }
    };

    return Object.entries(specialtyStats).map(([specialty, stats]) => {
      const mapping = categoryMappings[specialty] || {
        name: specialty,
        description: `Professional ${specialty.toLowerCase()} service`,
        image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop'
      };

      return {
        id: specialty.toLowerCase().replace(/\s+/g, '-'),
        name: mapping.name,
        description: mapping.description,
        image_url: mapping.image,
        rating: Math.round(stats.avgRating * 10) / 10,
        price_range: `$${stats.avgRate - 10}-${stats.avgRate + 10}`,
        category: specialty,
        cleaner_count: stats.count,
        average_completion_time: '2-3 hours',
      };
    });
  }

  private mapGuestToCleanerProfile(guestCleaner: any): CleanerProfile {
    return {
      id: guestCleaner.id,
      name: guestCleaner.name,
      avatar_url: guestCleaner.avatar_url,
      rating_average: guestCleaner.rating,
      total_jobs: guestCleaner.total_jobs,
      hourly_rate: guestCleaner.hourly_rate,
      bio: guestCleaner.bio,
      specialties: guestCleaner.specialties,
      verification_status: 'verified',
      is_available: true,
      service_radius_km: 25,
    };
  }
}

export const serviceDiscoveryService = new ServiceDiscoveryService();

