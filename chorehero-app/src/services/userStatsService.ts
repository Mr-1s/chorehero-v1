import { supabase } from './supabase';

export interface UserStats {
  totalBookings: number;
  completedBookings: number;
  totalSpent: number;
  favoriteCleaners: number;
  averageRating?: number;
  totalSavings?: number;
}

export interface CleanerStats {
  totalJobs: number;
  completedJobs: number;
  totalEarnings: number;
  averageRating: number;
  totalClients: number;
  repeatClients: number;
  responseTime?: number; // in minutes
  completionRate?: number; // percentage
}

class UserStatsService {
  /**
   * Calculate comprehensive statistics for a customer
   */
  async getCustomerStats(customerId: string): Promise<{ success: boolean; data?: UserStats; error?: string }> {
    try {
      console.log('📊 Calculating customer stats for:', customerId);

      // Get all bookings for this customer
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          total_amount,
          created_at,
          cleaner_id
        `)
        .eq('customer_id', customerId);

      if (bookingsError) {
        throw bookingsError;
      }

      // Get favorite cleaners (cleaners they've booked more than once)
      const { data: favoriteCleaners, error: favoritesError } = await supabase
        .from('bookings')
        .select('cleaner_id')
        .eq('customer_id', customerId)
        .eq('status', 'completed');

      if (favoritesError) {
        console.warn('Warning getting favorites:', favoritesError);
      }

      // Calculate statistics
      const totalBookings = bookings?.length || 0;
      const completedBookings = bookings?.filter(b => b.status === 'completed').length || 0;
      const totalSpent = bookings?.reduce((sum, booking) => sum + (booking.total_amount || 0), 0) || 0;
      
      // Count favorite cleaners (cleaners booked more than once)
      const cleanerBookingCounts = favoriteCleaners?.reduce((acc, booking) => {
        acc[booking.cleaner_id] = (acc[booking.cleaner_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const favoriteCleanersCount = Object.values(cleanerBookingCounts).filter(count => count > 1).length;

      // Calculate average rating given by customer (from ratings table)
      const { data: ratings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rater_id', customerId);
      
      const averageRating = ratings && ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : undefined;

      const stats: UserStats = {
        totalBookings,
        completedBookings,
        totalSpent,
        favoriteCleaners: favoriteCleanersCount,
        averageRating: averageRating ? Math.round(averageRating * 10) / 10 : undefined,
      };

      console.log('✅ Customer stats calculated:', stats);
      return { success: true, data: stats };

    } catch (error) {
      console.error('❌ Error calculating customer stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate stats'
      };
    }
  }

  /**
   * Calculate comprehensive statistics for a cleaner
   */
  async getCleanerStats(cleanerId: string): Promise<{ success: boolean; data?: CleanerStats; error?: string }> {
    try {
      console.log('📊 Calculating cleaner stats for:', cleanerId);

      // Get all jobs for this cleaner
      const { data: jobs, error: jobsError } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          cleaner_earnings,
          created_at,
          customer_id,
          scheduled_time,
          actual_end_time
        `)
        .eq('cleaner_id', cleanerId);

      if (jobsError) {
        throw jobsError;
      }

      // Calculate basic statistics
      const totalJobs = jobs?.length || 0;
      const completedJobs = jobs?.filter(j => j.status === 'completed').length || 0;
      const totalEarnings = jobs?.filter(j => j.status === 'completed')
        .reduce((sum, job) => sum + (job.cleaner_earnings || 0), 0) || 0;

      // Calculate average rating from ratings table
      const { data: ratings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_id', cleanerId);
      
      const averageRating = ratings && ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      // Count unique clients
      const uniqueCustomers = new Set(jobs?.map(j => j.customer_id) || []).size;

      // Count repeat clients (customers who booked more than once)
      const customerBookingCounts = jobs?.reduce((acc, job) => {
        acc[job.customer_id] = (acc[job.customer_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const repeatClients = Object.values(customerBookingCounts).filter(count => count > 1).length;

      // Response time placeholder - would need additional tracking
      const avgResponseTime: number | undefined = undefined;

      // Calculate completion rate
      const acceptedJobs = jobs?.filter(j => j.status !== 'cancelled' && j.status !== 'pending') || [];
      const completionRate = acceptedJobs.length > 0 
        ? (completedJobs / acceptedJobs.length) * 100 
        : undefined;

      const stats: CleanerStats = {
        totalJobs,
        completedJobs,
        totalEarnings,
        averageRating: Math.round(averageRating * 10) / 10,
        totalClients: uniqueCustomers,
        repeatClients,
        responseTime: avgResponseTime ? Math.round(avgResponseTime) : undefined,
        completionRate: completionRate ? Math.round(completionRate) : undefined,
      };

      console.log('✅ Cleaner stats calculated:', stats);
      return { success: true, data: stats };

    } catch (error) {
      console.error('❌ Error calculating cleaner stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate stats'
      };
    }
  }

  /**
   * Get recent booking activity for a customer
   */
  async getCustomerRecentActivity(customerId: string, limit: number = 5): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const { data: recentBookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          total_amount,
          created_at,
          scheduled_time,
          actual_end_time,
          service_type,
          cleaner_id
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }
      const cleanerIds = Array.from(
        new Set((recentBookings || []).map((b: any) => b.cleaner_id).filter(Boolean))
      );
      let cleanerMap: Record<string, any> = {};
      if (cleanerIds.length > 0) {
        const { data: cleaners } = await supabase
          .from('users')
          .select('id, name, avatar_url')
          .in('id', cleanerIds);
        cleanerMap = (cleaners || []).reduce((acc: any, c: any) => {
          acc[c.id] = c;
          return acc;
        }, {});
      }
      const hydrated = (recentBookings || []).map((booking: any) => ({
        ...booking,
        cleaner: booking.cleaner_id ? cleanerMap[booking.cleaner_id] || null : null,
      }));
      return { success: true, data: hydrated };
    } catch (error) {
      console.error('❌ Error getting recent activity:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get recent activity'
      };
    }
  }

  /**
   * Get upcoming bookings for a customer
   */
  async getCustomerUpcomingBookings(customerId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      const { data: upcomingBookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          total_amount,
          scheduled_time,
          service_type,
          special_instructions,
          cleaner_id
        `)
        .eq('customer_id', customerId)
        .in('status', ['confirmed', 'in_progress'])
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true });

      if (error) {
        throw error;
      }
      const cleanerIds = Array.from(
        new Set((upcomingBookings || []).map((b: any) => b.cleaner_id).filter(Boolean))
      );
      let cleanerMap: Record<string, any> = {};
      if (cleanerIds.length > 0) {
        const { data: cleaners } = await supabase
          .from('users')
          .select('id, name, avatar_url, phone')
          .in('id', cleanerIds);
        cleanerMap = (cleaners || []).reduce((acc: any, c: any) => {
          acc[c.id] = c;
          return acc;
        }, {});
      }
      const hydrated = (upcomingBookings || []).map((booking: any) => ({
        ...booking,
        cleaner: booking.cleaner_id ? cleanerMap[booking.cleaner_id] || null : null,
      }));
      return { success: true, data: hydrated };
    } catch (error) {
      console.error('❌ Error getting upcoming bookings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get upcoming bookings'
      };
    }
  }

  /**
   * Get earnings data for a cleaner with time periods
   */
  async getCleanerEarnings(cleanerId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfWeek = new Date(startOfDay);
      startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get earnings by time period
      const { data: completedJobs, error } = await supabase
        .from('bookings')
        .select('cleaner_earnings, actual_end_time')
        .eq('cleaner_id', cleanerId)
        .eq('status', 'completed')
        .not('actual_end_time', 'is', null);

      if (error) {
        throw error;
      }

      const jobs = completedJobs || [];
      
      const todayEarnings = jobs
        .filter(job => job.actual_end_time && new Date(job.actual_end_time) >= startOfDay)
        .reduce((sum, job) => sum + (job.cleaner_earnings || 0), 0);

      const weeklyEarnings = jobs
        .filter(job => job.actual_end_time && new Date(job.actual_end_time) >= startOfWeek)
        .reduce((sum, job) => sum + (job.cleaner_earnings || 0), 0);

      const monthlyEarnings = jobs
        .filter(job => job.actual_end_time && new Date(job.actual_end_time) >= startOfMonth)
        .reduce((sum, job) => sum + (job.cleaner_earnings || 0), 0);

      const totalEarnings = jobs.reduce((sum, job) => sum + (job.cleaner_earnings || 0), 0);

      return {
        success: true,
        data: {
          today: todayEarnings,
          week: weeklyEarnings,
          month: monthlyEarnings,
          total: totalEarnings,
          jobCount: jobs.length
        }
      };
    } catch (error) {
      console.error('❌ Error calculating earnings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate earnings'
      };
    }
  }
}

export const userStatsService = new UserStatsService();

