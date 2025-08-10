import { supabase } from './supabase';

export interface SampleCleaner {
  id: string;
  name: string;
  phone: string;
  email: string;
  avatar_url: string;
  role: 'cleaner';
  is_active: boolean;
  profile: {
    video_profile_url: string;
    hourly_rate: number;
    rating_average: number;
    total_jobs: number;
    bio: string;
    specialties: string[];
    verification_status: 'verified';
    is_available: boolean;
    service_radius_km: number;
  };
}

const SAMPLE_CLEANERS: SampleCleaner[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Sarah Martinez',
    phone: '+1-555-0123',
    email: 'sarah.martinez@chorehero.com',
    avatar_url: 'https://randomuser.me/api/portraits/women/32.jpg',
    role: 'cleaner',
    is_active: true,
    profile: {
      video_profile_url: 'https://assets.mixkit.co/videos/7862/7862-720.mp4',
      hourly_rate: 89,
      rating_average: 4.9,
      total_jobs: 145,
      bio: 'Professional house cleaner with 5+ years of experience. Specializing in deep cleaning and kitchen organization. Eco-friendly products available upon request.',
      specialties: ['Deep Cleaning', 'Kitchen Organization', 'Eco-Friendly'],
      verification_status: 'verified',
      is_available: true,
      service_radius_km: 25,
    },
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Maria Lopez',
    phone: '+1-555-0124',
    email: 'maria.lopez@chorehero.com',
    avatar_url: 'https://randomuser.me/api/portraits/women/45.jpg',
    role: 'cleaner',
    is_active: true,
    profile: {
      video_profile_url: 'https://assets.mixkit.co/videos/1190/1190-720.mp4',
      hourly_rate: 75,
      rating_average: 4.8,
      total_jobs: 89,
      bio: 'Eco-friendly cleaning specialist. I use only natural, non-toxic products that are safe for your family and pets.',
      specialties: ['Eco Cleaning', 'Bathroom Specialist', 'Pet-Safe Cleaning'],
      verification_status: 'verified',
      is_available: true,
      service_radius_km: 20,
    },
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Jennifer Chen',
    phone: '+1-555-0125',
    email: 'jennifer.chen@chorehero.com',
    avatar_url: 'https://randomuser.me/api/portraits/women/28.jpg',
    role: 'cleaner',
    is_active: true,
    profile: {
      video_profile_url: 'https://assets.mixkit.co/videos/1208/1208-720.mp4',
      hourly_rate: 95,
      rating_average: 5.0,
      total_jobs: 203,
      bio: 'Premium cleaning service with attention to detail. Specialized in luxury homes and office spaces.',
      specialties: ['Luxury Cleaning', 'Office Cleaning', 'Detail-Oriented'],
      verification_status: 'verified',
      is_available: true,
      service_radius_km: 30,
    },
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Amanda Rodriguez',
    phone: '+1-555-0126',
    email: 'amanda.rodriguez@chorehero.com',
    avatar_url: 'https://randomuser.me/api/portraits/women/35.jpg',
    role: 'cleaner',
    is_active: true,
    profile: {
      video_profile_url: 'https://assets.mixkit.co/videos/7862/7862-720.mp4',
      hourly_rate: 82,
      rating_average: 4.7,
      total_jobs: 67,
      bio: 'Fast and efficient cleaner specializing in quick turnarounds. Perfect for busy professionals.',
      specialties: ['Speed Cleaning', 'Express Service', 'Professional Homes'],
      verification_status: 'verified',
      is_available: true,
      service_radius_km: 15,
    },
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'Stephanie Williams',
    phone: '+1-555-0127',
    email: 'stephanie.williams@chorehero.com',
    avatar_url: 'https://randomuser.me/api/portraits/women/40.jpg',
    role: 'cleaner',
    is_active: true,
    profile: {
      video_profile_url: 'https://assets.mixkit.co/videos/1190/1190-720.mp4',
      hourly_rate: 78,
      rating_average: 4.6,
      total_jobs: 124,
      bio: 'Experienced cleaner with a focus on organization and decluttering. Making your space both clean and functional.',
      specialties: ['Organization', 'Decluttering', 'Move-in/Move-out'],
      verification_status: 'verified',
      is_available: true,
      service_radius_km: 22,
    },
  },
];

export const initializeSampleData = async (): Promise<boolean> => {
  try {
    console.log('Sample data initialization disabled - using real data only');
    return true; // Return true to avoid errors, but don't create any mock data

    // Insert sample users
    for (const cleaner of SAMPLE_CLEANERS) {
      // Insert user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: cleaner.id,
          name: cleaner.name,
          phone: cleaner.phone,
          email: cleaner.email,
          avatar_url: cleaner.avatar_url,
          role: cleaner.role,
          is_active: cleaner.is_active,
        })
        .select()
        .single();

      if (userError) {
        console.error(`Error inserting user ${cleaner.name}:`, userError);
        continue;
      }

      // Insert cleaner profile
      const { error: profileError } = await supabase
        .from('cleaner_profiles')
        .insert({
          user_id: cleaner.id,
          video_profile_url: cleaner.profile.video_profile_url,
          hourly_rate: cleaner.profile.hourly_rate,
          rating_average: cleaner.profile.rating_average,
          total_jobs: cleaner.profile.total_jobs,
          bio: cleaner.profile.bio,
          specialties: cleaner.profile.specialties,
          verification_status: cleaner.profile.verification_status,
          is_available: cleaner.profile.is_available,
          service_radius_km: cleaner.profile.service_radius_km,
          rating_count: cleaner.profile.total_jobs, // Assume each job got a rating
          total_earnings: cleaner.profile.total_jobs * cleaner.profile.hourly_rate * 2, // Estimate
        });

      if (profileError) {
        console.error(`Error inserting profile for ${cleaner.name}:`, profileError);
        continue;
      }

      console.log(`✅ Created cleaner: ${cleaner.name}`);
    }

    console.log('✅ Sample data initialization complete');
    return true;

  } catch (error) {
    console.error('Error initializing sample data:', error);
    return false;
  }
};

export const clearSampleData = async (): Promise<boolean> => {
  try {
    console.log('Clearing sample data...');
    
    // Delete cleaner profiles first (due to foreign key constraints)
    const { error: profileError } = await supabase
      .from('cleaner_profiles')
      .delete()
      .in('user_id', SAMPLE_CLEANERS.map(c => c.id));

    if (profileError) {
      console.error('Error deleting cleaner profiles:', profileError);
      return false;
    }

    // Delete users
    const { error: userError } = await supabase
      .from('users')
      .delete()
      .in('id', SAMPLE_CLEANERS.map(c => c.id));

    if (userError) {
      console.error('Error deleting users:', userError);
      return false;
    }

    console.log('✅ Sample data cleared');
    return true;

  } catch (error) {
    console.error('Error clearing sample data:', error);
    return false;
  }
};

export const getSampleVideoUrls = (): string[] => {
  return [
    'https://assets.mixkit.co/videos/29385/29385-720.mp4', // Washing dishes in kitchen (perfect for cleaning app!)
    'https://assets.mixkit.co/videos/1190/1190-720.mp4', // Kitchen/cooking video (can represent kitchen cleaning)
    'https://assets.mixkit.co/videos/1208/1208-720.mp4', // Home/lifestyle video
    'https://assets.mixkit.co/videos/7863/7863-720.mp4', // Alternative cleaning video
    'https://assets.mixkit.co/videos/1201/1201-720.mp4', // Home interior video
  ];
};

export const getSampleCleaners = (): SampleCleaner[] => {
  return SAMPLE_CLEANERS;
};

// Helper function to test the video feed with sample data
export const testVideoFeed = async (): Promise<void> => {
  try {
    console.log('Testing video feed...');

    const { data, error } = await supabase
      .from('cleaner_profiles')
      .select(`
        *,
        users!inner(name, avatar_url)
      `)
      .eq('users.role', 'cleaner')
      .not('video_profile_url', 'is', null)
      .limit(5);

    if (error) {
      console.error('Video feed test error:', error);
      return;
    }

    console.log('Video feed test results:', data);
    console.log(`✅ Found ${data?.length || 0} cleaners with videos`);

  } catch (error) {
    console.error('Error testing video feed:', error);
  }
};

// Function to fetch cleaner data by ID
export const getCleanerById = async (cleanerId: string): Promise<SampleCleaner | null> => {
  try {
    console.log(`Fetching cleaner data for ID: ${cleanerId}`);

    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        cleaner_profiles(*)
      `)
      .eq('id', cleanerId)
      .eq('role', 'cleaner')
      .single();

    if (error) {
      console.error('Error fetching cleaner:', error);
      return null;
    }

    if (!data) {
      console.log('Cleaner not found');
      return null;
    }

    // Transform the data to match SampleCleaner interface
    const cleaner: SampleCleaner = {
      id: data.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      avatar_url: data.avatar_url,
      role: data.role,
      is_active: data.is_active,
      profile: {
        video_profile_url: data.cleaner_profiles?.video_profile_url || '',
        hourly_rate: data.cleaner_profiles?.hourly_rate || 0,
        rating_average: data.cleaner_profiles?.rating_average || 0,
        total_jobs: data.cleaner_profiles?.total_jobs || 0,
        bio: data.cleaner_profiles?.bio || '',
        specialties: data.cleaner_profiles?.specialties || [],
        verification_status: data.cleaner_profiles?.verification_status || 'verified',
        is_available: data.cleaner_profiles?.is_available || false,
        service_radius_km: data.cleaner_profiles?.service_radius_km || 0,
      },
    };

    console.log(`✅ Found cleaner: ${cleaner.name}`);
    return cleaner;

  } catch (error) {
    console.error('Error fetching cleaner by ID:', error);
    return null;
  }
};

// Function to fetch cleaner services (mock data for now)
export const getCleanerServices = async (cleanerId: string): Promise<any[]> => {
  // In a real app, this would fetch from a services table
  // For now, return mock services based on cleaner specialties
  const cleaner = await getCleanerById(cleanerId);
  
  if (!cleaner) return [];

  const baseServices = [
    {
      id: '1',
      title: 'Kitchen Deep Clean',
      description: 'Complete kitchen deep cleaning including appliances, cabinets, and surfaces',
      price: cleaner.profile.hourly_rate,
      duration: '2-3 hours',
      image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    },
    {
      id: '2',
      title: 'Bathroom Deep Clean',
      description: 'Thorough bathroom cleaning and sanitization',
      price: Math.round(cleaner.profile.hourly_rate * 0.85),
      duration: '1-2 hours',
      image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    },
    {
      id: '3',
      title: 'Window Cleaning',
      description: 'Professional window cleaning for crystal clear views',
      price: Math.round(cleaner.profile.hourly_rate * 1.1),
      duration: '1-3 hours',
      image: 'https://images.unsplash.com/photo-1596815064285-45ed8a9c0463?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
    },
  ];

  return baseServices;
};

// Function to fetch cleaner reviews (mock data for now)
export const getCleanerReviews = async (cleanerId: string): Promise<any[]> => {
  // In a real app, this would fetch from a reviews table
  // For now, return mock reviews
  const mockReviews = [
    {
      id: '1',
      user: {
        name: 'Alex Morgan',
        avatar: 'https://randomuser.me/api/portraits/women/32.jpg',
      },
      rating: 5,
      comment: 'Excellent service! Everything was spotless and very professional.',
      date: 'Dec 15, 2023',
    },
    {
      id: '2',
      user: {
        name: 'James Wilson',
        avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
      },
      rating: 5,
      comment: 'Great work! My bathroom has never been cleaner. Highly recommend!',
      date: 'Dec 12, 2023',
    },
    {
      id: '3',
      user: {
        name: 'Emma Davis',
        avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
      },
      rating: 4,
      comment: 'Very thorough and professional. Will definitely book again.',
      date: 'Dec 10, 2023',
    },
  ];

  return mockReviews;
};