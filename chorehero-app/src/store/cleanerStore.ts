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

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_CLEANER: Cleaner = {
  id: 'cleaner-1',
  name: 'Sarah Martinez',
  avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
  rating: 4.9,
  totalJobs: 127,
  hourlyRate: 35,
  specialties: ['Deep Clean', 'Move-out', 'Eco-Friendly'],
  isOnline: true,
  profileCompletion: 0.88,
  weeklyEarnings: 847.50,
  todayEarnings: 142.00,
};

const MOCK_AVAILABLE_BOOKINGS: Booking[] = [
  {
    id: 'booking-1',
    customerName: 'Emily Chen',
    customerAvatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    customerRating: 4.8,
    customerTotalBookings: 12,
    serviceType: 'Standard Clean',
    addOns: ['Inside Fridge', 'Oven Cleaning'],
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    durationMinutes: 120,
    distanceMiles: 1.2,
    addressLine1: '1234 Oak Street, Apt 5B',
    isInstant: true,
    status: 'offered',
    payoutToCleaner: 71.40,
    totalPrice: 102.00,
    hasSpecialRequests: true,
    specialRequestText: 'Please use unscented cleaning products. I have allergies.',
  },
  {
    id: 'booking-2',
    customerName: 'Michael Johnson',
    customerAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    customerRating: 4.5,
    customerTotalBookings: 8,
    serviceType: 'Deep Clean',
    addOns: ['Window Cleaning', 'Laundry'],
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    durationMinutes: 180,
    distanceMiles: 3.5,
    addressLine1: '567 Pine Avenue',
    isInstant: false,
    status: 'offered',
    payoutToCleaner: 126.00,
    totalPrice: 180.00,
    hasSpecialRequests: false,
  },
  {
    id: 'booking-3',
    customerName: 'Jessica Williams',
    customerAvatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    customerRating: 5.0,
    customerTotalBookings: 24,
    serviceType: 'Express Clean',
    addOns: [],
    scheduledAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
    durationMinutes: 60,
    distanceMiles: 0.8,
    addressLine1: '890 Maple Drive, Unit 12',
    isInstant: true,
    status: 'offered',
    payoutToCleaner: 42.00,
    totalPrice: 60.00,
    hasSpecialRequests: false,
  },
];

const MOCK_ACTIVE_BOOKINGS: Booking[] = [
  {
    id: 'booking-active-1',
    customerName: 'David Brown',
    customerAvatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
    customerRating: 4.7,
    customerTotalBookings: 15,
    serviceType: 'Standard Clean',
    addOns: ['Bathroom Deep Clean'],
    scheduledAt: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour from now
    durationMinutes: 90,
    distanceMiles: 2.1,
    addressLine1: '321 Cedar Lane',
    isInstant: false,
    status: 'accepted',
    payoutToCleaner: 56.00,
    totalPrice: 80.00,
    hasSpecialRequests: false,
  },
];

const MOCK_PAST_BOOKINGS: Booking[] = [
  {
    id: 'booking-past-1',
    customerName: 'Amanda Taylor',
    customerAvatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    customerRating: 4.9,
    customerTotalBookings: 30,
    serviceType: 'Deep Clean',
    addOns: ['Garage Cleaning'],
    scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
    durationMinutes: 240,
    distanceMiles: 4.2,
    addressLine1: '456 Birch Street',
    isInstant: false,
    status: 'completed',
    payoutToCleaner: 168.00,
    totalPrice: 240.00,
    hasSpecialRequests: false,
  },
];

const MOCK_VIDEO_STATS: VideoStats = {
  totalViews: 12450,
  bookingsFromVideos: 23,
  conversionRate: 0.032,
  avgViewsPerVideo: 1245,
};

const MOCK_VIDEO_TIPS: VideoTip[] = [
  { id: '1', text: 'Show before and after transformations for maximum impact' },
  { id: '2', text: 'Keep videos between 30-45 seconds for best engagement' },
  { id: '3', text: 'Post 2-3 times per week to stay visible' },
  { id: '4', text: 'Use natural lighting to showcase your work' },
];

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    participantName: 'Emily Chen',
    participantAvatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200',
    lastMessagePreview: 'Thanks for the great cleaning!',
    lastMessageTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    unreadCount: 2,
  },
  {
    id: 'conv-2',
    participantName: 'David Brown',
    participantAvatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200',
    lastMessagePreview: 'See you tomorrow at 2pm!',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
  },
  {
    id: 'conv-3',
    participantName: 'ChoreHero Support',
    participantAvatarUrl: undefined,
    lastMessagePreview: 'Your verification is complete!',
    lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unreadCount: 1,
  },
];

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
          weeklyEarnings: cleanerProfile?.total_earnings || 0,
          todayEarnings: 0,
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

