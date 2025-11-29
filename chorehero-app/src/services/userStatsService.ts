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
          total_cost,
          created_at,
          cleaner_id,
          customer_rating
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
      const totalSpent = bookings?.reduce((sum, booking) => sum + (booking.total_cost || 0), 0) || 0;
      
      // Count favorite cleaners (cleaners booked more than once)
      const cleanerBookingCounts = favoriteCleaners?.reduce((acc, booking) => {
        acc[booking.cleaner_id] = (acc[booking.cleaner_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const favoriteCleanersCount = Object.values(cleanerBookingCounts).filter(count => count > 1).length;

      // Calculate average rating given by customer
      const ratingsGiven = bookings?.filter(b => b.customer_rating && b.status === 'completed') || [];
      const averageRating = ratingsGiven.length > 0 
        ? ratingsGiven.reduce((sum, b) => sum + b.customer_rating, 0) / ratingsGiven.length
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
          total_cost,
          created_at,
          customer_id,
          cleaner_rating,
          scheduled_time,
          completed_at,
          cleaner_responded_at
        `)
        .eq('cleaner_id', cleanerId);

      if (jobsError) {
        throw jobsError;
      }

      // Calculate basic statistics
      const totalJobs = jobs?.length || 0;
      const completedJobs = jobs?.filter(j => j.status === 'completed').length || 0;
      const totalEarnings = jobs?.filter(j => j.status === 'completed')
        .reduce((sum, job) => sum + (job.total_cost || 0), 0) || 0;

      // Calculate average rating
      const ratingsReceived = jobs?.filter(j => j.cleaner_rating && j.status === 'completed') || [];
      const averageRating = ratingsReceived.length > 0 
        ? ratingsReceived.reduce((sum, j) => sum + j.cleaner_rating, 0) / ratingsReceived.length
        : 0;

      // Count unique clients
      const uniqueCustomers = new Set(jobs?.map(j => j.customer_id) || []).size;

      // Count repeat clients (customers who booked more than once)
      const customerBookingCounts = jobs?.reduce((acc, job) => {
        acc[job.customer_id] = (acc[job.customer_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};
      
      const repeatClients = Object.values(customerBookingCounts).filter(count => count > 1).length;

      // Calculate response time (average time to respond to booking requests)
      const jobsWithResponseTime = jobs?.filter(j => j.cleaner_responded_at && j.created_at) || [];
      const avgResponseTime = jobsWithResponseTime.length > 0
        ? jobsWithResponseTime.reduce((sum, job) => {
            const responseTime = new Date(job.cleaner_responded_at).getTime() - new Date(job.created_at).getTime();
            return sum + (responseTime / (1000 * 60)); // Convert to minutes
          }, 0) / jobsWithResponseTime.length
        : undefined;

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
          total_cost,
          created_at,
          scheduled_time,
          completed_at,
          service_type,
          users!cleaner_id (
            name,
            avatar_url
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return { success: true, data: recentBookings || [] };
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
          total_cost,
          scheduled_time,
          service_type,
          special_instructions,
          users!cleaner_id (
            name,
            avatar_url,
            phone
          )
        `)
        .eq('customer_id', customerId)
        .in('status', ['confirmed', 'in_progress'])
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true });

      if (error) {
        throw error;
      }

      return { success: true, data: upcomingBookings || [] };
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
        .select('total_cost, completed_at')
        .eq('cleaner_id', cleanerId)
        .eq('status', 'completed')
        .not('completed_at', 'is', null);

      if (error) {
        throw error;
      }

      const jobs = completedJobs || [];
      
      const todayEarnings = jobs
        .filter(job => new Date(job.completed_at) >= startOfDay)
        .reduce((sum, job) => sum + job.total_cost, 0);

      const weeklyEarnings = jobs
        .filter(job => new Date(job.completed_at) >= startOfWeek)
        .reduce((sum, job) => sum + job.total_cost, 0);

      const monthlyEarnings = jobs
        .filter(job => new Date(job.completed_at) >= startOfMonth)
        .reduce((sum, job) => sum + job.total_cost, 0);

      const totalEarnings = jobs.reduce((sum, job) => sum + job.total_cost, 0);

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

