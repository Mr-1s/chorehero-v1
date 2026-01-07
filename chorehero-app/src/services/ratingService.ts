/**
 * Comprehensive Rating Service
 * Handles all rating and review operations for the ChoreHero platform
 */

import { supabase } from './supabase';

// Types
export interface Rating {
  id: string;
  booking_id: string;
  rater_id: string;
  rated_id: string;
  rating: number; // 1-5 stars
  comment?: string;
  video_testimonial_url?: string;
  
  // Category ratings
  communication_rating?: number;
  timeliness_rating?: number;
  quality_rating?: number;
  professionalism_rating?: number;
  
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  
  // Populated fields
  rater?: {
    id: string;
    name: string;
    avatar_url?: string;
    role: string;
  };
  booking?: {
    id: string;
    service_type: string;
    scheduled_time: string;
    total_amount: number;
  };
}

export interface RatingStats {
  averageRating: number;
  totalRatings: number;
  ratingDistribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  categoryAverages: {
    communication: number;
    timeliness: number;
    quality: number;
    professionalism: number;
  };
}

export interface CreateRatingRequest {
  booking_id: string;
  rated_id: string;
  rating: number;
  comment?: string;
  video_testimonial_url?: string;
  communication_rating?: number;
  timeliness_rating?: number;
  quality_rating?: number;
  professionalism_rating?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

class RatingService {
  
  // ============================================================================
  // CORE RATING OPERATIONS
  // ============================================================================
  
  /**
   * Submit a rating for a completed booking
   */
  async submitRating(raterId: string, ratingData: CreateRatingRequest): Promise<ApiResponse<Rating>> {
    try {
      console.log('⭐ Submitting rating:', { raterId, bookingId: ratingData.booking_id });

      // Validate the booking exists and is completed
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status, customer_id, cleaner_id, service_type, scheduled_time, total_amount')
        .eq('id', ratingData.booking_id)
        .single();

      if (bookingError) throw new Error('Booking not found');
      if (booking.status !== 'completed') throw new Error('Can only rate completed bookings');

      // Verify the rater is part of this booking
      if (raterId !== booking.customer_id && raterId !== booking.cleaner_id) {
        throw new Error('You can only rate bookings you were part of');
      }

      // Check if rating already exists
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('booking_id', ratingData.booking_id)
        .eq('rater_id', raterId)
        .single();

      if (existingRating) {
        throw new Error('You have already rated this booking');
      }

      // Validate rating values
      if (ratingData.rating < 1 || ratingData.rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }

      // Create the rating
      const { data: newRating, error: ratingError } = await supabase
        .from('ratings')
        .insert([{
          booking_id: ratingData.booking_id,
          rater_id: raterId,
          rated_id: ratingData.rated_id,
          rating: ratingData.rating,
          comment: ratingData.comment,
          video_testimonial_url: ratingData.video_testimonial_url,
          communication_rating: ratingData.communication_rating,
          timeliness_rating: ratingData.timeliness_rating,
          quality_rating: ratingData.quality_rating,
          professionalism_rating: ratingData.professionalism_rating,
          is_visible: true
        }])
        .select(`
          *,
          rater:users!rater_id(id, name, avatar_url, role),
          booking:bookings(id, service_type, scheduled_time, total_amount)
        `)
        .single();

      if (ratingError) throw ratingError;

      // Update user's average rating
      await this.updateUserAverageRating(ratingData.rated_id);

      console.log('✅ Rating submitted successfully:', newRating.id);
      return { success: true, data: newRating as Rating };

    } catch (error) {
      console.error('❌ Error submitting rating:', error);
      return {
        success: false,
        data: {} as Rating,
        error: error instanceof Error ? error.message : 'Failed to submit rating'
      };
    }
  }

  /**
   * Get ratings for a specific user
   */
  async getUserRatings(userId: string, limit: number = 20, offset: number = 0): Promise<ApiResponse<Rating[]>> {
    try {
      console.log('📋 Getting ratings for user:', userId);

      const { data: ratings, error } = await supabase
        .from('ratings')
        .select(`
          *,
          rater:users!rater_id(id, name, avatar_url, role),
          booking:bookings(id, service_type, scheduled_time, total_amount)
        `)
        .eq('rated_id', userId)
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      console.log(`✅ Got ${ratings?.length || 0} ratings for user`);
      return { success: true, data: ratings as Rating[] || [] };

    } catch (error) {
      console.error('❌ Error getting user ratings:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get ratings'
      };
    }
  }

  /**
   * Get rating statistics for a user
   */
  async getUserRatingStats(userId: string): Promise<ApiResponse<RatingStats>> {
    try {
      console.log('📊 Getting rating stats for user:', userId);

      const { data: ratings, error } = await supabase
        .from('ratings')
        .select(`
          rating,
          communication_rating,
          timeliness_rating,
          quality_rating,
          professionalism_rating
        `)
        .eq('rated_id', userId)
        .eq('is_visible', true);

      if (error) throw error;

      const ratingsData = ratings || [];
      const totalRatings = ratingsData.length;

      if (totalRatings === 0) {
        return {
          success: true,
          data: {
            averageRating: 0,
            totalRatings: 0,
            ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
            categoryAverages: {
              communication: 0,
              timeliness: 0,
              quality: 0,
              professionalism: 0
            }
          }
        };
      }

      // Calculate average rating
      const totalScore = ratingsData.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = totalScore / totalRatings;

      // Calculate rating distribution
      const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      ratingsData.forEach(r => {
        distribution[r.rating as keyof typeof distribution]++;
      });

      // Calculate category averages
      const categoryTotals = {
        communication: 0,
        timeliness: 0,
        quality: 0,
        professionalism: 0
      };
      const categoryCounts = {
        communication: 0,
        timeliness: 0,
        quality: 0,
        professionalism: 0
      };

      ratingsData.forEach(r => {
        if (r.communication_rating) {
          categoryTotals.communication += r.communication_rating;
          categoryCounts.communication++;
        }
        if (r.timeliness_rating) {
          categoryTotals.timeliness += r.timeliness_rating;
          categoryCounts.timeliness++;
        }
        if (r.quality_rating) {
          categoryTotals.quality += r.quality_rating;
          categoryCounts.quality++;
        }
        if (r.professionalism_rating) {
          categoryTotals.professionalism += r.professionalism_rating;
          categoryCounts.professionalism++;
        }
      });

      const categoryAverages = {
        communication: categoryCounts.communication > 0 ? categoryTotals.communication / categoryCounts.communication : 0,
        timeliness: categoryCounts.timeliness > 0 ? categoryTotals.timeliness / categoryCounts.timeliness : 0,
        quality: categoryCounts.quality > 0 ? categoryTotals.quality / categoryCounts.quality : 0,
        professionalism: categoryCounts.professionalism > 0 ? categoryTotals.professionalism / categoryCounts.professionalism : 0
      };

      const stats: RatingStats = {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        totalRatings,
        ratingDistribution: distribution,
        categoryAverages
      };

      console.log('✅ Rating stats calculated:', stats);
      return { success: true, data: stats };

    } catch (error) {
      console.error('❌ Error calculating rating stats:', error);
      return {
        success: false,
        data: {
          averageRating: 0,
          totalRatings: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          categoryAverages: {
            communication: 0,
            timeliness: 0,
            quality: 0,
            professionalism: 0
          }
        },
        error: error instanceof Error ? error.message : 'Failed to calculate rating stats'
      };
    }
  }

  /**
   * Get rating for a specific booking
   */
  async getBookingRating(bookingId: string, raterId?: string): Promise<ApiResponse<Rating | null>> {
    try {
      console.log('🔍 Getting rating for booking:', bookingId);

      let query = supabase
        .from('ratings')
        .select(`
          *,
          rater:users!rater_id(id, name, avatar_url, role),
          booking:bookings(id, service_type, scheduled_time, total_amount)
        `)
        .eq('booking_id', bookingId);

      if (raterId) {
        query = query.eq('rater_id', raterId);
      }

      const { data: rating, error } = await query.single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found

      console.log('✅ Got booking rating:', rating?.id || 'none');
      return { success: true, data: rating as Rating || null };

    } catch (error) {
      console.error('❌ Error getting booking rating:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get booking rating'
      };
    }
  }

  /**
   * Update an existing rating
   */
  async updateRating(ratingId: string, raterId: string, updates: Partial<CreateRatingRequest>): Promise<ApiResponse<Rating>> {
    try {
      console.log('✏️ Updating rating:', ratingId);

      // Verify the rating belongs to the rater
      const { data: existingRating, error: fetchError } = await supabase
        .from('ratings')
        .select('id, rater_id, rated_id')
        .eq('id', ratingId)
        .eq('rater_id', raterId)
        .single();

      if (fetchError) throw new Error('Rating not found or access denied');

      // Validate rating values if provided
      if (updates.rating && (updates.rating < 1 || updates.rating > 5)) {
        throw new Error('Rating must be between 1 and 5');
      }

      // Update the rating
      const { data: updatedRating, error: updateError } = await supabase
        .from('ratings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', ratingId)
        .select(`
          *,
          rater:users!rater_id(id, name, avatar_url, role),
          booking:bookings(id, service_type, scheduled_time, total_amount)
        `)
        .single();

      if (updateError) throw updateError;

      // Update user's average rating if overall rating changed
      if (updates.rating) {
        await this.updateUserAverageRating(existingRating.rated_id);
      }

      console.log('✅ Rating updated successfully');
      return { success: true, data: updatedRating as Rating };

    } catch (error) {
      console.error('❌ Error updating rating:', error);
      return {
        success: false,
        data: {} as Rating,
        error: error instanceof Error ? error.message : 'Failed to update rating'
      };
    }
  }

  /**
   * Delete a rating (hide it)
   */
  async deleteRating(ratingId: string, raterId: string): Promise<ApiResponse<boolean>> {
    try {
      console.log('🗑️ Deleting rating:', ratingId);

      // Verify the rating belongs to the rater
      const { data: existingRating, error: fetchError } = await supabase
        .from('ratings')
        .select('id, rated_id')
        .eq('id', ratingId)
        .eq('rater_id', raterId)
        .single();

      if (fetchError) throw new Error('Rating not found or access denied');

      // Hide the rating instead of deleting
      const { error: updateError } = await supabase
        .from('ratings')
        .update({ is_visible: false })
        .eq('id', ratingId);

      if (updateError) throw updateError;

      // Update user's average rating
      await this.updateUserAverageRating(existingRating.rated_id);

      console.log('✅ Rating deleted successfully');
      return { success: true, data: true };

    } catch (error) {
      console.error('❌ Error deleting rating:', error);
      return {
        success: false,
        data: false,
        error: error instanceof Error ? error.message : 'Failed to delete rating'
      };
    }
  }

  // ============================================================================
  // ANALYTICS & INSIGHTS
  // ============================================================================

  /**
   * Get top-rated cleaners
   */
  async getTopRatedCleaners(limit: number = 10): Promise<ApiResponse<Array<{
    user_id: string;
    name: string;
    avatar_url?: string;
    average_rating: number;
    total_ratings: number;
  }>>> {
    try {
      console.log('🏆 Getting top-rated cleaners');

      // Get cleaners with their rating stats
      const { data: cleaners, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          avatar_url,
          cleaner_profiles!inner(user_id, average_rating, total_bookings)
        `)
        .eq('role', 'cleaner')
        .eq('is_active', true)
        .gte('cleaner_profiles.average_rating', 4.0) // Only show highly rated cleaners
        .order('cleaner_profiles.average_rating', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const topCleaners = (cleaners || []).map(cleaner => ({
        user_id: cleaner.id,
        name: cleaner.name,
        avatar_url: cleaner.avatar_url,
        average_rating: cleaner.cleaner_profiles.average_rating || 0,
        total_ratings: cleaner.cleaner_profiles.total_bookings || 0
      }));

      console.log(`✅ Got ${topCleaners.length} top-rated cleaners`);
      return { success: true, data: topCleaners };

    } catch (error) {
      console.error('❌ Error getting top-rated cleaners:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get top-rated cleaners'
      };
    }
  }

  /**
   * Get recent reviews for display
   */
  async getRecentReviews(limit: number = 10): Promise<ApiResponse<Rating[]>> {
    try {
      console.log('📝 Getting recent reviews');

      const { data: reviews, error } = await supabase
        .from('ratings')
        .select(`
          *,
          rater:users!rater_id(id, name, avatar_url, role),
          rated:users!rated_id(id, name, avatar_url, role),
          booking:bookings(id, service_type, scheduled_time, total_amount)
        `)
        .eq('is_visible', true)
        .not('comment', 'is', null)
        .gte('rating', 4) // Only show positive reviews
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      console.log(`✅ Got ${reviews?.length || 0} recent reviews`);
      return { success: true, data: reviews as Rating[] || [] };

    } catch (error) {
      console.error('❌ Error getting recent reviews:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get recent reviews'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Update user's average rating in their profile
   */
  private async updateUserAverageRating(userId: string): Promise<void> {
    try {
      const { data: stats } = await this.getUserRatingStats(userId);
      if (!stats) return;

      // Check if user is a cleaner or customer and update appropriate profile
      const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (!user) return;

      if (user.role === 'cleaner') {
        await supabase
          .from('cleaner_profiles')
          .update({ average_rating: stats.averageRating })
          .eq('user_id', userId);
      } else if (user.role === 'customer') {
        await supabase
          .from('customer_profiles')
          .update({ average_rating: stats.averageRating })
          .eq('user_id', userId);
      }

      console.log('✅ Updated average rating for user:', userId, stats.averageRating);

    } catch (error) {
      console.error('❌ Error updating user average rating:', error);
    }
  }

  /**
   * Check if user can rate a booking
   */
  async canRateBooking(userId: string, bookingId: string): Promise<ApiResponse<{
    canRate: boolean;
    reason?: string;
  }>> {
    try {
      // Check if booking exists and is completed
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('id, status, customer_id, cleaner_id')
        .eq('id', bookingId)
        .single();

      if (bookingError) {
        return { success: true, data: { canRate: false, reason: 'Booking not found' } };
      }

      if (booking.status !== 'completed') {
        return { success: true, data: { canRate: false, reason: 'Booking must be completed to rate' } };
      }

      if (userId !== booking.customer_id && userId !== booking.cleaner_id) {
        return { success: true, data: { canRate: false, reason: 'You can only rate bookings you were part of' } };
      }

      // Check if already rated
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('rater_id', userId)
        .single();

      if (existingRating) {
        return { success: true, data: { canRate: false, reason: 'You have already rated this booking' } };
      }

      return { success: true, data: { canRate: true } };

    } catch (error) {
      console.error('❌ Error checking rating eligibility:', error);
      return {
        success: false,
        data: { canRate: false },
        error: error instanceof Error ? error.message : 'Failed to check rating eligibility'
      };
    }
  }
}

export const ratingService = new RatingService();
export default ratingService;