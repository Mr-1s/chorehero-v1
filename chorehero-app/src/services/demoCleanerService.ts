import { supabase } from './supabase';

export interface DemoCleanerData {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  bio: string;
  specialties: string[];
  hourly_rate: number;
  rating_average: number;
  total_jobs: number;
  years_experience: number;
  verification_status: 'verified' | 'pending' | 'rejected';
  is_available: boolean;
  service_radius_km: number;
  video_profile_url?: string;
}

export interface DemoCleanerStats {
  todayEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  totalEarnings: number;
  completedJobs: number;
  activeJobs: number;
  averageRating: number;
  totalReviews: number;
  repeatCustomers: number;
}

export interface DemoBooking {
  id: string;
  customer_name: string;
  customer_avatar: string;
  service_type: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  scheduled_time: string;
  estimated_duration: number;
  total_cost: number;
  address: string;
  special_instructions?: string;
}

class DemoCleanerService {
  private demoCleaner: DemoCleanerData = {
    id: 'demo_cleaner_001',
    name: 'Sarah Rodriguez',
    email: 'sarah.demo@chorehero.com',
    phone: '+1-555-DEMO-01',
    avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face',
    bio: 'Professional cleaning specialist with 8+ years of experience. I specialize in deep cleaning, eco-friendly products, and maintaining spotless homes. Certified in green cleaning practices and committed to exceptional customer service.',
    specialties: ['Deep Cleaning', 'Eco-Friendly Products', 'Kitchen Specialist', 'Bathroom Specialist', 'Move-in/Move-out'],
    hourly_rate: 45,
    rating_average: 4.9,
    total_jobs: 247,
    years_experience: 8,
    verification_status: 'verified',
    is_available: true,
    service_radius_km: 25,
    video_profile_url: 'https://pixabay.com/videos/download/video-27501/?type=mp4&size=medium'
  };

  private demoStats: DemoCleanerStats = {
    todayEarnings: 180,
    weeklyEarnings: 1240,
    monthlyEarnings: 5680,
    totalEarnings: 28400,
    completedJobs: 247,
    activeJobs: 3,
    averageRating: 4.9,
    totalReviews: 183,
    repeatCustomers: 89
  };

  private demoBookings: DemoBooking[] = [
    {
      id: 'demo_booking_001',
      customer_name: 'Emma Thompson',
      customer_avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
      service_type: 'Deep Clean',
      status: 'confirmed',
      scheduled_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      estimated_duration: 180,
      total_cost: 135,
      address: '123 Oak Street, San Francisco, CA',
      special_instructions: 'Please focus on kitchen deep clean. Cat-friendly products preferred.'
    },
    {
      id: 'demo_booking_002',
      customer_name: 'Michael Chen',
      customer_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
      service_type: 'Standard Clean',
      status: 'in_progress',
      scheduled_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      estimated_duration: 90,
      total_cost: 75,
      address: '456 Pine Avenue, San Francisco, CA'
    },
    {
      id: 'demo_booking_003',
      customer_name: 'Lisa Park',
      customer_avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop&crop=face',
      service_type: 'Move-out Clean',
      status: 'pending',
      scheduled_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      estimated_duration: 240,
      total_cost: 200,
      address: '789 Market Street, San Francisco, CA',
      special_instructions: 'Full apartment move-out clean. Keys available with building manager.'
    },
    {
      id: 'demo_booking_004',
      customer_name: 'James Wilson',
      customer_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
      service_type: 'Standard Clean',
      status: 'completed',
      scheduled_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      estimated_duration: 90,
      total_cost: 75,
      address: '321 Castro Street, San Francisco, CA'
    }
  ];

  /**
   * Check if the current user is the demo cleaner
   */
  async isDemoCleanerUser(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return false;
      
      // Check if this user has demo cleaner characteristics
      const isDemoId = user.id === this.demoCleaner.id || user.id.startsWith('demo_cleaner');
      const isDemoEmail = user.email === this.demoCleaner.email || user.email?.includes('demo');
      
      console.log('🔍 Checking demo cleaner status:', {
        userId: user.id,
        userEmail: user.email,
        isDemoId,
        isDemoEmail
      });
      
      return isDemoId || isDemoEmail;
    } catch (error) {
      console.error('Error checking demo cleaner status:', error);
      return false;
    }
  }

  /**
   * Get demo cleaner profile data
   */
  getDemoCleanerData(): DemoCleanerData {
    return { ...this.demoCleaner };
  }

  /**
   * Get demo cleaner statistics
   */
  getDemoCleanerStats(): DemoCleanerStats {
    return { ...this.demoStats };
  }

  /**
   * Get demo bookings for the cleaner
   */
  getDemoBookings(status?: string): DemoBooking[] {
    if (status) {
      return this.demoBookings.filter(booking => booking.status === status);
    }
    return [...this.demoBookings];
  }

  /**
   * Get upcoming bookings (confirmed and pending)
   */
  getUpcomingBookings(): DemoBooking[] {
    const now = new Date();
    return this.demoBookings
      .filter(booking => 
        (booking.status === 'confirmed' || booking.status === 'pending') &&
        new Date(booking.scheduled_time) > now
      )
      .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
  }

  /**
   * Get recent completed bookings
   */
  getRecentCompletedBookings(limit: number = 5): DemoBooking[] {
    return this.demoBookings
      .filter(booking => booking.status === 'completed')
      .sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime())
      .slice(0, limit);
  }

  /**
   * Get current active booking (in_progress)
   */
  getActiveBooking(): DemoBooking | null {
    const activeBooking = this.demoBookings.find(booking => booking.status === 'in_progress');
    return activeBooking || null;
  }

  /**
   * Update booking status (for demo purposes)
   */
  updateBookingStatus(bookingId: string, newStatus: DemoBooking['status']): boolean {
    const bookingIndex = this.demoBookings.findIndex(booking => booking.id === bookingId);
    if (bookingIndex !== -1) {
      this.demoBookings[bookingIndex].status = newStatus;
      console.log(`📋 Demo booking ${bookingId} status updated to ${newStatus}`);
      return true;
    }
    return false;
  }

  /**
   * Simulate accepting a booking
   */
  acceptBooking(bookingId: string): boolean {
    return this.updateBookingStatus(bookingId, 'confirmed');
  }

  /**
   * Simulate starting a job
   */
  startJob(bookingId: string): boolean {
    return this.updateBookingStatus(bookingId, 'in_progress');
  }

  /**
   * Simulate completing a job
   */
  completeJob(bookingId: string): boolean {
    const success = this.updateBookingStatus(bookingId, 'completed');
    if (success) {
      // Update stats
      this.demoStats.completedJobs += 1;
      this.demoStats.activeJobs = Math.max(0, this.demoStats.activeJobs - 1);
      
      // Add to today's earnings
      const booking = this.demoBookings.find(b => b.id === bookingId);
      if (booking) {
        this.demoStats.todayEarnings += booking.total_cost;
        this.demoStats.weeklyEarnings += booking.total_cost;
        this.demoStats.monthlyEarnings += booking.total_cost;
        this.demoStats.totalEarnings += booking.total_cost;
      }
    }
    return success;
  }

  /**
   * Get demo cleaner's available services
   */
  getAvailableServices() {
    return [
      {
        id: 'standard_clean',
        name: 'Standard Clean',
        description: 'Regular maintenance cleaning',
        duration: 90,
        base_price: 75
      },
      {
        id: 'deep_clean',
        name: 'Deep Clean',
        description: 'Thorough detailed cleaning',
        duration: 180,
        base_price: 135
      },
      {
        id: 'move_clean',
        name: 'Move-in/Move-out Clean',
        description: 'Complete move-related cleaning',
        duration: 240,
        base_price: 200
      },
      {
        id: 'eco_clean',
        name: 'Eco-Friendly Clean',
        description: 'Green cleaning with eco products',
        duration: 120,
        base_price: 95
      }
    ];
  }

  /**
   * Get demo reviews for the cleaner
   */
  getDemoReviews() {
    return [
      {
        id: 'review_001',
        customer_name: 'Jennifer Martinez',
        customer_avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face',
        rating: 5,
        comment: 'Sarah did an amazing job! My kitchen has never looked so clean. She was punctual, professional, and used eco-friendly products as requested.',
        date: '2024-01-15',
        service_type: 'Deep Clean'
      },
      {
        id: 'review_002',
        customer_name: 'David Kim',
        customer_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
        rating: 5,
        comment: 'Excellent service! Sarah is very detail-oriented and left our apartment spotless. Will definitely book again.',
        date: '2024-01-10',
        service_type: 'Standard Clean'
      },
      {
        id: 'review_003',
        customer_name: 'Rachel Brown',
        customer_avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face',
        rating: 5,
        comment: 'Perfect for our move-out clean! Sarah made sure we got our full deposit back. Highly recommend!',
        date: '2024-01-05',
        service_type: 'Move-out Clean'
      }
    ];
  }
}

export const demoCleanerService = new DemoCleanerService();
