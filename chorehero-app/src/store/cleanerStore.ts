/**
 * Cleaner Store - Zustand state management for cleaner-side app
 */

import { create } from 'zustand';
import type { 
  Cleaner, 
  Booking, 
  BookingStatus,
  VideoStats, 
  VideoTip, 
  Conversation 
} from '../types/cleaner';
import { cleanerBookingService } from '../services/cleanerBookingService';
import { trackingWorkflowService } from '../services/trackingWorkflowService';
import { supabase } from '../services/supabase';
import { notificationService } from '../services/notificationService';

// ============================================================================
// MOCK DATA - REMOVED (All screens now use real database data)
// ============================================================================
// Note: All mock data constants have been removed.
// The app now loads real data from Supabase for authenticated users.
// Empty states are shown for new users with no data.

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface CleanerState {
  // Data
  currentCleaner: Cleaner | null;
  availableBookings: Booking[];
  activeBookings: Booking[];
  pastBookings: Booking[];
  videoStats: VideoStats | null;
  videoTips: VideoTip[];
  conversations: Conversation[];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Actions
  fetchDashboard: () => Promise<void>;
  acceptBooking: (id: string) => Promise<void>;
  declineBooking: (id: string) => Promise<void>;
  startTraveling: (id: string) => Promise<void>;
  markInProgress: (id: string) => Promise<void>;
  markCompleted: (id: string) => Promise<void>;
  markConversationRead: (id: string) => void;
  toggleOnlineStatus: () => void;
  refreshData: () => Promise<void>;
}

// ============================================================================
// STORE IMPLEMENTATION
// ============================================================================

export const useCleanerStore = create<CleanerState>((set, get) => ({
  // Initial state
  currentCleaner: null,
  availableBookings: [],
  activeBookings: [],
  pastBookings: [],
  videoStats: null,
  videoTips: [],
  conversations: [],
  isLoading: true,
  isRefreshing: false,

  // Fetch all dashboard data
  fetchDashboard: async () => {
    set({ isLoading: true });
    
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      if (userId && !userId.startsWith('demo_')) {
        // Fetch real data from database
        console.log('📊 Fetching real cleaner dashboard data...');
        
        const [available, active, past] = await Promise.all([
          cleanerBookingService.getAvailableBookings(userId),
          cleanerBookingService.getActiveBookings(userId),
          cleanerBookingService.getPastBookings(userId),
        ]);

        // Fetch cleaner profile
        const { data: cleanerProfile } = await supabase
          .from('cleaner_profiles')
          .select('*, user:users(*)')
          .eq('user_id', userId)
          .single();

        // Calculate today's earnings from completed bookings today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();
        
        const { data: todayBookings } = await supabase
          .from('bookings')
          .select('cleaner_earnings, total_amount')
          .eq('cleaner_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', todayISO);
        
        const todayEarningsCalc = (todayBookings || []).reduce((sum, b) => {
          return sum + (b.cleaner_earnings || (b.total_amount * 0.85) || 0);
        }, 0);

        // Calculate this week's earnings (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);
        const weekAgoISO = weekAgo.toISOString();
        
        const { data: weekBookings } = await supabase
          .from('bookings')
          .select('cleaner_earnings, total_amount')
          .eq('cleaner_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', weekAgoISO);
        
        const weeklyEarningsCalc = (weekBookings || []).reduce((sum, b) => {
          return sum + (b.cleaner_earnings || (b.total_amount * 0.85) || 0);
        }, 0);

        // Calculate profile completion based on actual data
        const calculateProfileCompletion = (profile: any, user: any): number => {
          const fields = [
            { filled: !!user?.avatar_url, weight: 1 },           // Profile photo
            { filled: !!profile?.bio && profile.bio.length > 10, weight: 1 }, // Bio
            { filled: !!profile?.video_profile_url, weight: 1 }, // Intro video
            { filled: profile?.verification_status === 'verified', weight: 1 }, // ID verified
            { filled: !!profile?.background_check_date, weight: 1 }, // Background check
            { filled: !!profile?.hourly_rate, weight: 1 },       // Hourly rate set
            { filled: (profile?.specialties?.length || 0) > 0, weight: 1 }, // Specialties
            { filled: !!profile?.years_experience, weight: 1 },  // Experience
          ];
          
          const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
          const filledWeight = fields.reduce((sum, f) => sum + (f.filled ? f.weight : 0), 0);
          
          return filledWeight / totalWeight;
        };

        const profileCompletion = cleanerProfile 
          ? calculateProfileCompletion(cleanerProfile, cleanerProfile.user)
          : 0;

        // Build cleaner from profile or create basic profile from session
        const realCleaner: Cleaner = {
          id: userId,
          name: cleanerProfile?.user?.name || session?.user?.email?.split('@')[0] || 'Cleaner',
          avatarUrl: cleanerProfile?.user?.avatar_url,
          rating: cleanerProfile?.rating_average || 0,
          totalJobs: cleanerProfile?.total_jobs || past.length,
          hourlyRate: cleanerProfile?.hourly_rate || 25,
          specialties: cleanerProfile?.specialties || [],
          isOnline: cleanerProfile?.is_available || false,
          profileCompletion,
          weeklyEarnings: weeklyEarningsCalc,
          todayEarnings: todayEarningsCalc,
          verificationStatus: cleanerProfile?.verification_status,
          onboardingState: cleanerProfile?.user?.cleaner_onboarding_state ?? null,
          backgroundCheckStatus: (cleanerProfile as any)?.background_check_status ?? null,
          videoProfileUrl: cleanerProfile?.video_profile_url ?? null,
        };

        set({
          currentCleaner: realCleaner,
          availableBookings: available,
          activeBookings: active,
          pastBookings: past,
          videoStats: null,
          videoTips: [],
          conversations: [],
          isLoading: false,
        });
        
        console.log(`✅ Loaded ${available.length} available, ${active.length} active, ${past.length} past bookings`);
      } else {
        // No authenticated user - show empty state
        console.log('📊 No authenticated cleaner - showing empty state...');
        
        set({
          currentCleaner: null,
          availableBookings: [],
          activeBookings: [],
          pastBookings: [],
          videoStats: null,
          videoTips: [],
          conversations: [],
          isLoading: false,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      // Show empty state on error
      set({
        currentCleaner: null,
        availableBookings: [],
        activeBookings: [],
        pastBookings: [],
        videoStats: null,
        videoTips: [],
        conversations: [],
        isLoading: false,
      });
    }
  },

  // Accept a booking - move from available to active
  acceptBooking: async (id: string) => {
    const { availableBookings, activeBookings } = get();
    
    const booking = availableBookings.find(b => b.id === id);
    if (!booking) return;
    
    // Optimistic update
    const updatedBooking: Booking = { ...booking, status: 'accepted' };
    
    set({
      availableBookings: availableBookings.filter(b => b.id !== id),
      activeBookings: [...activeBookings, updatedBooking],
    });
    
    try {
      // Check if this is a real UUID (not mock data like "booking-1")
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isValidUUID) {
        // Try real API for real bookings
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id && !session.user.id.startsWith('demo_')) {
          const success = await cleanerBookingService.acceptBooking(id, session.user.id);
          if (!success) throw new Error('Failed to accept booking');
        }
      } else {
        // Mock delay for demo/mock bookings
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      // Rollback on error
      set({
        availableBookings: [...availableBookings],
        activeBookings: activeBookings.filter(b => b.id !== id),
      });
      throw error;
    }
  },

  // Decline a booking - remove from available
  declineBooking: async (id: string) => {
    const { availableBookings } = get();
    
    // Optimistic update
    set({
      availableBookings: availableBookings.filter(b => b.id !== id),
    });
    
    // In production, call API here
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      // Rollback on error
      set({ availableBookings });
      throw error;
    }
  },

  // Update booking status to on_the_way and start tracking
  startTraveling: async (id: string) => {
    const { activeBookings, currentCleaner } = get();
    
    // Optimistic update
    set({
      activeBookings: activeBookings.map(b => 
        b.id === id ? { ...b, status: 'on_the_way' as BookingStatus } : b
      ),
    });
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cleanerId = session?.user?.id;
      const cleanerName = currentCleaner?.name || 'Your ChoreHero';
      
      if (cleanerId && !cleanerId.startsWith('demo_')) {
        // Start the full tracking workflow (GPS + notifications)
        const result = await trackingWorkflowService.startCleanerTracking(
          id,
          cleanerId,
          cleanerName
        );
        
        if (!result.success) {
          console.warn('⚠️ Tracking workflow warning:', result.error);
          // Still update status even if tracking fails
          await cleanerBookingService.updateBookingStatus(id, 'cleaner_en_route');
        }
      }
    } catch (error) {
      console.error('Error starting travel tracking:', error);
    }
  },

  // Update booking status to in_progress
  markInProgress: async (id: string) => {
    const { activeBookings } = get();
    
    set({
      activeBookings: activeBookings.map(b => 
        b.id === id ? { ...b, status: 'in_progress' as BookingStatus } : b
      ),
    });
  },

  // Complete a booking - move from active to past
  markCompleted: async (id: string) => {
    const { activeBookings, pastBookings, currentCleaner } = get();
    
    const booking = activeBookings.find(b => b.id === id);
    if (!booking) return;

    try {
      // Check if this is a valid UUID (real booking)
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      
      if (isValidUUID && currentCleaner?.id) {
        // Use RPC for atomic complete (verifies cleaner owns booking, status is in_progress)
        const success = await cleanerBookingService.markJobComplete(id, currentCleaner.id);
        if (!success) {
          console.error('❌ Error completing booking');
          return;
        }

        // Get cleaner's total completed jobs to check if this is their first
        const { data: profile } = await supabase
          .from('cleaner_profiles')
          .select('total_jobs, user_id')
          .eq('user_id', currentCleaner?.id)
          .single();

        const previousJobCount = profile?.total_jobs || 0;

        // Update cleaner stats
        await supabase.rpc('increment_cleaner_bookings', {
          cleaner_id_param: currentCleaner?.id,
          booking_amount_param: booking.payoutToCleaner
        });

        // Send first job congratulations notification
        if (previousJobCount === 0) {
          console.log('🎉 First job completed! Sending congratulations...');
          await notificationService.sendNotification({
            type: 'system',
            title: '🎉 Congratulations on Your First Job!',
            message: `Amazing work! You've completed your first cleaning job and earned $${booking.payoutToCleaner.toFixed(2)}. Keep up the great work!`,
            toUserId: currentCleaner?.id || '',
            relatedId: id,
          });
        }

        // Send review request notification to customer
        const { data: bookingData } = await supabase
          .from('bookings')
          .select('customer_id')
          .eq('id', id)
          .single();

        if (bookingData?.customer_id) {
          await notificationService.sendNotification({
            type: 'booking_update',
            title: 'How was your cleaning? ⭐',
            message: `Your cleaning with ${currentCleaner?.name || 'your cleaner'} is complete! Tap to leave a review.`,
            toUserId: bookingData.customer_id,
            relatedId: id,
            fromUserId: currentCleaner?.id,
            fromUserName: currentCleaner?.name,
          });
        }

        console.log('✅ Booking completed and notifications sent');
      }
    } catch (error) {
      console.error('❌ Error in markCompleted:', error);
    }
    
    const completedBooking: Booking = { ...booking, status: 'completed' };
    
    set({
      activeBookings: activeBookings.filter(b => b.id !== id),
      pastBookings: [completedBooking, ...pastBookings],
      currentCleaner: currentCleaner ? {
        ...currentCleaner,
        totalJobs: currentCleaner.totalJobs + 1,
        todayEarnings: currentCleaner.todayEarnings + booking.payoutToCleaner,
        weeklyEarnings: currentCleaner.weeklyEarnings + booking.payoutToCleaner,
      } : null,
    });
  },

  // Mark conversation as read
  markConversationRead: (id: string) => {
    const { conversations } = get();
    
    set({
      conversations: conversations.map(c => 
        c.id === id ? { ...c, unreadCount: 0 } : c
      ),
    });
  },

  // Toggle online/offline status
  toggleOnlineStatus: () => {
    const { currentCleaner } = get();
    if (!currentCleaner) return;
    
    set({
      currentCleaner: {
        ...currentCleaner,
        isOnline: !currentCleaner.isOnline,
      },
    });
  },

  // Refresh all data (pull-to-refresh)
  refreshData: async () => {
    set({ isRefreshing: true });
    await get().fetchDashboard();
    set({ isRefreshing: false });
  },
}));

// ============================================================================
// SELECTORS
// ============================================================================

export const selectTotalUnreadMessages = (state: CleanerState) => 
  state.conversations.reduce((sum, c) => sum + c.unreadCount, 0);

export const selectFilteredBookings = (
  bookings: Booking[], 
  filter: 'all' | 'today' | 'tomorrow' | 'week'
): Booking[] => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  switch (filter) {
    case 'today':
      return bookings.filter(b => {
        const date = new Date(b.scheduledAt);
        return date >= today && date < tomorrow;
      });
    case 'tomorrow':
      return bookings.filter(b => {
        const date = new Date(b.scheduledAt);
        const dayAfterTomorrow = new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
        return date >= tomorrow && date < dayAfterTomorrow;
      });
    case 'week':
      return bookings.filter(b => {
        const date = new Date(b.scheduledAt);
        return date >= today && date < nextWeek;
      });
    default:
      return bookings;
  }
};

