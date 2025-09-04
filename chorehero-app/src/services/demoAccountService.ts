import { supabase } from './supabase';

export interface DemoCleanerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar_url: string;
  role: 'cleaner';
  profile: {
    hourly_rate: number;
    rating_average: number;
    total_jobs: number;
    bio: string;
    specialties: string[];
    verification_status: 'verified';
    is_available: boolean;
    service_radius_km: number;
    video_profile_url?: string;
    availability: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
    instant_booking: boolean;
  };
}

class DemoAccountService {
  private demoCleaner: DemoCleanerProfile = {
    id: 'demo_cleaner_professional_001',
    name: 'Sarah Martinez',
    email: 'demo.cleaner@chorehero.com',
    phone: '+1-555-DEMO-01',
    avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b612b1c5?w=200&h=200&fit=crop&crop=face',
    role: 'cleaner',
    profile: {
      hourly_rate: 45,
      rating_average: 4.9,
      total_jobs: 247,
      bio: 'Professional cleaning specialist with 8+ years of experience. I specialize in deep cleaning, eco-friendly products, and creating spotless spaces that make you feel at home. Certified in advanced sanitization techniques and committed to exceeding your expectations every time.',
      specialties: [
        'Deep Cleaning',
        'Eco-Friendly Cleaning',
        'Kitchen Deep Clean',
        'Bathroom Sanitization',
        'Post-Construction Cleanup',
        'Move-in/Move-out Cleaning'
      ],
      verification_status: 'verified',
      is_available: true,
      service_radius_km: 30,
      video_profile_url: 'https://pixabay.com/videos/download/video-16470_tiny.mp4',
      availability: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: true,
        sunday: false,
      },
      instant_booking: true,
    },
  };

  /**
   * Create or get the demo cleaner account
   */
  async createOrGetDemoCleaner(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('🎭 Creating/getting demo cleaner account...');

      // Check if demo cleaner already exists
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('id', this.demoCleaner.id)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding demo cleaner:', findError);
      }

      if (existingUser) {
        console.log('✅ Demo cleaner already exists');
        return { success: true, data: existingUser };
      }

      // Create demo cleaner user account
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          id: this.demoCleaner.id,
          name: this.demoCleaner.name,
          email: this.demoCleaner.email,
          phone: this.demoCleaner.phone,
          avatar_url: this.demoCleaner.avatar_url,
          role: this.demoCleaner.role,
          is_active: true,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (userError) {
        console.error('Error creating demo cleaner user:', userError);
        throw userError;
      }

      // Create cleaner profile
      const { data: newProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: this.demoCleaner.id,
          hourly_rate: this.demoCleaner.profile.hourly_rate,
          rating_average: this.demoCleaner.profile.rating_average,
          total_jobs: this.demoCleaner.profile.total_jobs,
          bio: this.demoCleaner.profile.bio,
          specialties: this.demoCleaner.profile.specialties,
          verification_status: this.demoCleaner.profile.verification_status,
          is_available: this.demoCleaner.profile.is_available,
          service_radius_km: this.demoCleaner.profile.service_radius_km,
          video_profile_url: this.demoCleaner.profile.video_profile_url,
          availability: this.demoCleaner.profile.availability,
          instant_booking: this.demoCleaner.profile.instant_booking,
          background_check_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (profileError) {
        console.error('Error creating demo cleaner profile:', profileError);
        // Try to clean up the user if profile creation fails
        await supabase.from('users').delete().eq('id', this.demoCleaner.id);
        throw profileError;
      }

      console.log('✅ Demo cleaner account created successfully');
      return { success: true, data: { user: newUser, profile: newProfile } };

    } catch (error) {
      console.error('❌ Error creating demo cleaner:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create demo cleaner'
      };
    }
  }

  /**
   * Create demo bookings and reviews for the demo cleaner
   */
  async createDemoCleanerData(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('📊 Creating demo data for cleaner...');

      // Ensure demo cleaner exists
      const cleanerResult = await this.createOrGetDemoCleaner();
      if (!cleanerResult.success) {
        throw new Error(cleanerResult.error);
      }

      // Create some demo bookings (historical completed ones)
      const demoBookings = [
        {
          id: 'demo_booking_001',
          customer_id: 'demo_customer_001', // This would be created separately
          cleaner_id: this.demoCleaner.id,
          service_type: 'deep_cleaning',
          status: 'completed',
          total_cost: 120,
          scheduled_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
          cleaner_rating: 5,
          customer_rating: 5,
          special_instructions: 'Please focus on the kitchen and bathrooms',
          location: { address: '123 Demo Street, San Francisco, CA' }
        },
        {
          id: 'demo_booking_002',
          customer_id: 'demo_customer_002',
          cleaner_id: this.demoCleaner.id,
          service_type: 'standard_cleaning',
          status: 'completed',
          total_cost: 85,
          scheduled_time: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
          cleaner_rating: 5,
          customer_rating: 4,
          special_instructions: 'Pet-friendly cleaning products only',
          location: { address: '456 Sample Ave, San Francisco, CA' }
        },
        {
          id: 'demo_booking_003',
          customer_id: 'demo_customer_003',
          cleaner_id: this.demoCleaner.id,
          service_type: 'kitchen_deep_clean',
          status: 'completed',
          total_cost: 95,
          scheduled_time: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000 + 2.5 * 60 * 60 * 1000).toISOString(),
          cleaner_rating: 5,
          customer_rating: 5,
          special_instructions: 'Focus on degreasing and appliance cleaning',
          location: { address: '789 Test Blvd, San Francisco, CA' }
        }
      ];

      // Note: In a real implementation, you'd also create demo customers
      // For now, we'll just log that these would be created
      console.log('📝 Would create demo bookings:', demoBookings.length);

      // Create demo reviews
      const demoReviews = [
        {
          id: 'demo_review_001',
          booking_id: 'demo_booking_001',
          customer_id: 'demo_customer_001',
          cleaner_id: this.demoCleaner.id,
          rating: 5,
          comment: 'Sarah did an absolutely amazing job! My kitchen has never looked so clean. She was professional, thorough, and even gave me tips for maintaining the cleanliness. Highly recommend!',
          created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'demo_review_002',
          booking_id: 'demo_booking_002',
          cleaner_id: this.demoCleaner.id,
          customer_id: 'demo_customer_002',
          rating: 4,
          comment: 'Great service overall. Sarah was punctual and did a good job. Used eco-friendly products as requested. Would book again.',
          created_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: 'demo_review_003',
          booking_id: 'demo_booking_003',
          customer_id: 'demo_customer_003',
          cleaner_id: this.demoCleaner.id,
          rating: 5,
          comment: 'Exceptional deep cleaning service! Sarah transformed my kitchen from greasy to gleaming. Professional equipment and techniques. Worth every penny!',
          created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
        }
      ];

      console.log('⭐ Would create demo reviews:', demoReviews.length);
      console.log('✅ Demo cleaner data structure ready');

      return { success: true };

    } catch (error) {
      console.error('❌ Error creating demo cleaner data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create demo data'
      };
    }
  }

  /**
   * Get demo cleaner for login/testing
   */
  getDemoCleanerCredentials(): { email: string; id: string; profile: DemoCleanerProfile } {
    return {
      email: this.demoCleaner.email,
      id: this.demoCleaner.id,
      profile: this.demoCleaner
    };
  }

  /**
   * Create a demo customer account for testing interactions
   */
  async createDemoCustomer(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const demoCustomer = {
        id: 'demo_customer_main_001',
        name: 'Alex Johnson',
        email: 'demo.customer@chorehero.com',
        phone: '+1-555-DEMO-02',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
        role: 'customer' as const,
        is_active: true,
      };

      // Check if demo customer already exists
      const { data: existingCustomer, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('id', demoCustomer.id)
        .single();

      if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding demo customer:', findError);
      }

      if (existingCustomer) {
        console.log('✅ Demo customer already exists');
        return { success: true, data: existingCustomer };
      }

      // Create demo customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('users')
        .insert(demoCustomer)
        .select()
        .single();

      if (customerError) {
        throw customerError;
      }

      console.log('✅ Demo customer created successfully');
      return { success: true, data: newCustomer };

    } catch (error) {
      console.error('❌ Error creating demo customer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create demo customer'
      };
    }
  }

  /**
   * Initialize all demo accounts and data
   */
  async initializeDemoData(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🎭 Initializing complete demo data...');

      // Create demo cleaner
      const cleanerResult = await this.createOrGetDemoCleaner();
      if (!cleanerResult.success) {
        throw new Error(`Failed to create demo cleaner: ${cleanerResult.error}`);
      }

      // Create demo customer
      const customerResult = await this.createDemoCustomer();
      if (!customerResult.success) {
        throw new Error(`Failed to create demo customer: ${customerResult.error}`);
      }

      // Create demo data relationships
      await this.createDemoCleanerData();

      console.log('✅ Demo data initialization complete');
      console.log('🎭 Demo accounts available:');
      console.log('   Cleaner:', this.demoCleaner.email);
      console.log('   Customer: demo.customer@chorehero.com');

      return { success: true };

    } catch (error) {
      console.error('❌ Error initializing demo data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize demo data'
      };
    }
  }

  /**
   * Check if demo accounts exist
   */
  async checkDemoAccountsExist(): Promise<{ cleaner: boolean; customer: boolean }> {
    try {
      const [cleanerResult, customerResult] = await Promise.all([
        supabase.from('users').select('id').eq('id', this.demoCleaner.id).single(),
        supabase.from('users').select('id').eq('id', 'demo_customer_main_001').single()
      ]);

      return {
        cleaner: !cleanerResult.error,
        customer: !customerResult.error
      };
    } catch (error) {
      return { cleaner: false, customer: false };
    }
  }
}

export const demoAccountService = new DemoAccountService();

