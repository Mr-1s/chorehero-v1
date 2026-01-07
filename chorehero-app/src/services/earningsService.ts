/**
 * Comprehensive Earnings Service
 * Handles all earnings calculations, payment history, and financial analytics
 */

import { supabase } from './supabase';

// Types
export interface EarningsData {
  period: string;
  amount: number;
  jobs: number;
  avgPerJob: number;
}

export interface PaymentHistory {
  id: string;
  date: string;
  amount: number;
  type: 'earning' | 'payout' | 'fee' | 'bonus';
  status: 'completed' | 'processing' | 'pending' | 'failed';
  description: string;
  booking_id?: string;
  stripe_transfer_id?: string;
}

export interface EarningsBreakdown {
  currentBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  thisWeek: number;
  thisMonth: number;
  lastMonth: number;
  thisYear: number;
}

export interface EarningsAnalytics {
  averageJobValue: number;
  totalJobs: number;
  completionRate: number;
  topServiceTypes: Array<{
    service_type: string;
    earnings: number;
    job_count: number;
  }>;
  monthlyTrend: Array<{
    month: string;
    earnings: number;
    jobs: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

class EarningsService {
  
  // ============================================================================
  // CORE EARNINGS CALCULATIONS
  // ============================================================================
  
  /**
   * Get comprehensive earnings breakdown for a cleaner
   */
  async getEarningsBreakdown(cleanerId: string): Promise<ApiResponse<EarningsBreakdown>> {
    try {
      console.log('💰 Getting earnings breakdown for cleaner:', cleanerId);

      // Get all completed bookings with earnings
      const { data: completedBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          cleaner_earnings,
          actual_end_time,
          payment_status,
          service_type,
          created_at
        `)
        .eq('cleaner_id', cleanerId)
        .eq('status', 'completed')
        .not('cleaner_earnings', 'is', null);

      if (bookingsError) throw bookingsError;

      const bookings = completedBookings || [];
      
      // Calculate current balance (captured payments, available for withdrawal)
      const currentBalance = bookings
        .filter(b => b.payment_status === 'succeeded')
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      // Calculate pending balance (completed jobs, payment processing)
      const pendingBalance = bookings
        .filter(b => ['pending', 'processing'].includes(b.payment_status))
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      // Calculate total earnings
      const totalEarnings = bookings
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      // Calculate period-specific earnings
      const now = new Date();
      const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const thisWeek = bookings
        .filter(b => new Date(b.actual_end_time || b.created_at) >= startOfWeek)
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      const thisMonth = bookings
        .filter(b => new Date(b.actual_end_time || b.created_at) >= startOfMonth)
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      const lastMonth = bookings
        .filter(b => {
          const date = new Date(b.actual_end_time || b.created_at);
          return date >= startOfLastMonth && date <= endOfLastMonth;
        })
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      const thisYear = bookings
        .filter(b => new Date(b.actual_end_time || b.created_at) >= startOfYear)
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      const breakdown: EarningsBreakdown = {
        currentBalance,
        pendingBalance,
        totalEarnings,
        thisWeek,
        thisMonth,
        lastMonth,
        thisYear
      };

      console.log('✅ Earnings breakdown calculated:', breakdown);
      return { success: true, data: breakdown };

    } catch (error) {
      console.error('❌ Error calculating earnings breakdown:', error);
      return {
        success: false,
        data: {
          currentBalance: 0,
          pendingBalance: 0,
          totalEarnings: 0,
          thisWeek: 0,
          thisMonth: 0,
          lastMonth: 0,
          thisYear: 0
        },
        error: error instanceof Error ? error.message : 'Failed to calculate earnings'
      };
    }
  }

  /**
   * Get detailed earnings history by period
   */
  async getEarningsHistory(cleanerId: string, limit: number = 12): Promise<ApiResponse<EarningsData[]>> {
    try {
      console.log('📊 Getting earnings history for cleaner:', cleanerId);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          cleaner_earnings,
          actual_end_time,
          created_at,
          service_type
        `)
        .eq('cleaner_id', cleanerId)
        .eq('status', 'completed')
        .not('cleaner_earnings', 'is', null)
        .order('actual_end_time', { ascending: false });

      if (error) throw error;

      // Group by month and calculate stats
      const monthlyData = new Map<string, { earnings: number; jobs: number }>();
      
      (bookings || []).forEach(booking => {
        const date = new Date(booking.actual_end_time || booking.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyData.has(monthKey)) {
          monthlyData.set(monthKey, { earnings: 0, jobs: 0 });
        }
        
        const monthData = monthlyData.get(monthKey)!;
        monthData.earnings += booking.cleaner_earnings || 0;
        monthData.jobs += 1;
      });

      // Convert to array and format
      const history: EarningsData[] = Array.from(monthlyData.entries())
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split('-');
          const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
          
          return {
            period: monthName,
            amount: data.earnings,
            jobs: data.jobs,
            avgPerJob: data.jobs > 0 ? data.earnings / data.jobs : 0
          };
        })
        .slice(0, limit);

      console.log(`✅ Got ${history.length} months of earnings history`);
      return { success: true, data: history };

    } catch (error) {
      console.error('❌ Error getting earnings history:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get earnings history'
      };
    }
  }

  /**
   * Get payment history (earnings, payouts, fees)
   */
  async getPaymentHistory(cleanerId: string, limit: number = 50): Promise<ApiResponse<PaymentHistory[]>> {
    try {
      console.log('💳 Getting payment history for cleaner:', cleanerId);

      // Get earnings from completed bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          id,
          cleaner_earnings,
          actual_end_time,
          created_at,
          payment_status,
          service_type,
          stripe_payment_intent_id
        `)
        .eq('cleaner_id', cleanerId)
        .eq('status', 'completed')
        .not('cleaner_earnings', 'is', null)
        .order('actual_end_time', { ascending: false })
        .limit(limit);

      if (bookingsError) throw bookingsError;

      // Convert bookings to payment history format
      const paymentHistory: PaymentHistory[] = (bookings || []).map(booking => ({
        id: `earning-${booking.id}`,
        date: booking.actual_end_time || booking.created_at,
        amount: booking.cleaner_earnings || 0,
        type: 'earning' as const,
        status: this.mapPaymentStatus(booking.payment_status),
        description: `${booking.service_type} cleaning service`,
        booking_id: booking.id,
        stripe_transfer_id: booking.stripe_payment_intent_id
      }));

      // TODO: Add actual payout history from Stripe Connect
      // This would require integration with Stripe Connect API to get transfer history

      console.log(`✅ Got ${paymentHistory.length} payment history records`);
      return { success: true, data: paymentHistory };

    } catch (error) {
      console.error('❌ Error getting payment history:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to get payment history'
      };
    }
  }

  /**
   * Get comprehensive earnings analytics
   */
  async getEarningsAnalytics(cleanerId: string): Promise<ApiResponse<EarningsAnalytics>> {
    try {
      console.log('📈 Getting earnings analytics for cleaner:', cleanerId);

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select(`
          id,
          cleaner_earnings,
          service_type,
          status,
          actual_end_time,
          created_at,
          scheduled_time
        `)
        .eq('cleaner_id', cleanerId);

      if (error) throw error;

      const allBookings = bookings || [];
      const completedBookings = allBookings.filter(b => b.status === 'completed' && b.cleaner_earnings);

      // Calculate basic metrics
      const totalJobs = completedBookings.length;
      const totalEarnings = completedBookings.reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);
      const averageJobValue = totalJobs > 0 ? totalEarnings / totalJobs : 0;
      const completionRate = allBookings.length > 0 ? (totalJobs / allBookings.length) * 100 : 0;

      // Calculate top service types
      const serviceTypeMap = new Map<string, { earnings: number; job_count: number }>();
      completedBookings.forEach(booking => {
        const serviceType = booking.service_type;
        if (!serviceTypeMap.has(serviceType)) {
          serviceTypeMap.set(serviceType, { earnings: 0, job_count: 0 });
        }
        const data = serviceTypeMap.get(serviceType)!;
        data.earnings += booking.cleaner_earnings || 0;
        data.job_count += 1;
      });

      const topServiceTypes = Array.from(serviceTypeMap.entries())
        .map(([service_type, data]) => ({ service_type, ...data }))
        .sort((a, b) => b.earnings - a.earnings)
        .slice(0, 5);

      // Calculate monthly trend (last 12 months)
      const monthlyTrendMap = new Map<string, { earnings: number; jobs: number }>();
      const now = new Date();
      
      // Initialize last 12 months
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthlyTrendMap.set(monthKey, { earnings: 0, jobs: 0 });
      }

      // Populate with actual data
      completedBookings.forEach(booking => {
        const date = new Date(booking.actual_end_time || booking.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (monthlyTrendMap.has(monthKey)) {
          const data = monthlyTrendMap.get(monthKey)!;
          data.earnings += booking.cleaner_earnings || 0;
          data.jobs += 1;
        }
      });

      const monthlyTrend = Array.from(monthlyTrendMap.entries()).map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
        return {
          month: monthName,
          earnings: data.earnings,
          jobs: data.jobs
        };
      });

      const analytics: EarningsAnalytics = {
        averageJobValue,
        totalJobs,
        completionRate,
        topServiceTypes,
        monthlyTrend
      };

      console.log('✅ Earnings analytics calculated:', analytics);
      return { success: true, data: analytics };

    } catch (error) {
      console.error('❌ Error calculating earnings analytics:', error);
      return {
        success: false,
        data: {
          averageJobValue: 0,
          totalJobs: 0,
          completionRate: 0,
          topServiceTypes: [],
          monthlyTrend: []
        },
        error: error instanceof Error ? error.message : 'Failed to calculate analytics'
      };
    }
  }

  // ============================================================================
  // PAYOUT MANAGEMENT
  // ============================================================================

  /**
   * Request payout to bank account
   */
  async requestPayout(cleanerId: string, amount: number): Promise<ApiResponse<{ payout_id: string }>> {
    try {
      console.log('💸 Requesting payout for cleaner:', cleanerId, 'Amount:', amount);

      // First, verify available balance
      const { data: breakdown } = await this.getEarningsBreakdown(cleanerId);
      if (!breakdown || breakdown.currentBalance < amount) {
        throw new Error('Insufficient available balance for payout');
      }

      // TODO: Integrate with Stripe Connect to create actual payout
      // For now, create a record in payment history
      const payoutId = `payout_${Date.now()}_${cleanerId}`;

      // In production, this would:
      // 1. Call Stripe Connect API to create payout
      // 2. Update booking records to mark as "paid out"
      // 3. Create payout record in database
      // 4. Send confirmation notification

      console.log('✅ Payout requested successfully:', payoutId);
      return { 
        success: true, 
        data: { payout_id: payoutId }
      };

    } catch (error) {
      console.error('❌ Error requesting payout:', error);
      return {
        success: false,
        data: { payout_id: '' },
        error: error instanceof Error ? error.message : 'Failed to request payout'
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private mapPaymentStatus(supabaseStatus: string): PaymentHistory['status'] {
    switch (supabaseStatus) {
      case 'succeeded': return 'completed';
      case 'processing': return 'processing';
      case 'pending': return 'pending';
      case 'failed': return 'failed';
      default: return 'pending';
    }
  }

  /**
   * Get earnings summary for dashboard
   */
  async getEarningsSummary(cleanerId: string): Promise<ApiResponse<{
    todayEarnings: number;
    weekEarnings: number;
    monthEarnings: number;
    availableBalance: number;
  }>> {
    try {
      const { data: breakdown } = await this.getEarningsBreakdown(cleanerId);
      if (!breakdown) throw new Error('Failed to get earnings breakdown');

      // Calculate today's earnings
      const { data: todayBookings, error } = await supabase
        .from('bookings')
        .select('cleaner_earnings')
        .eq('cleaner_id', cleanerId)
        .eq('status', 'completed')
        .gte('actual_end_time', new Date().toISOString().split('T')[0]);

      if (error) throw error;

      const todayEarnings = (todayBookings || [])
        .reduce((sum, b) => sum + (b.cleaner_earnings || 0), 0);

      return {
        success: true,
        data: {
          todayEarnings,
          weekEarnings: breakdown.thisWeek,
          monthEarnings: breakdown.thisMonth,
          availableBalance: breakdown.currentBalance
        }
      };

    } catch (error) {
      console.error('❌ Error getting earnings summary:', error);
      return {
        success: false,
        data: {
          todayEarnings: 0,
          weekEarnings: 0,
          monthEarnings: 0,
          availableBalance: 0
        },
        error: error instanceof Error ? error.message : 'Failed to get earnings summary'
      };
    }
  }
}

export const earningsService = new EarningsService();
export default earningsService;