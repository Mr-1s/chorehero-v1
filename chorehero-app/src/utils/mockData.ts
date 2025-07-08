// Mock Data for ChoreHero Demo
// Realistic cleaning videos, photos, and cleaner profiles

import { Cleaner } from '../types/user';

interface CleanerWithDistance extends Cleaner {
  distance_km: number;
  video_profile_url: string;
  before_photos?: string[];
  after_photos?: string[];
}

// Real cleaning video URLs (from free video sources)
const CLEANING_VIDEOS = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', // Placeholder 1
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', // Placeholder 2
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', // Placeholder 3
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', // Placeholder 4
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', // Placeholder 5
];

// Realistic cleaning before/after photos (from Unsplash)
const CLEANING_PHOTOS = {
  before_kitchen: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Messy kitchen
    'https://images.unsplash.com/photo-1565182999561-18d7dc61c393?w=800&q=80', // Dirty dishes
    'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&q=80', // Cluttered counter
  ],
  after_kitchen: [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80', // Clean modern kitchen
    'https://images.unsplash.com/photo-1556909195-e4c11aabe38b?w=800&q=80', // Spotless kitchen
    'https://images.unsplash.com/photo-1556909079-e8c6b8f7f5f5?w=800&q=80', // Organized kitchen
  ],
  before_bathroom: [
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80', // Bathroom before
    'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&q=80', // Dirty bathroom
  ],
  after_bathroom: [
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80', // Clean bathroom
    'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&q=80', // Sparkling bathroom
  ],
  before_living: [
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80', // Messy living room
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // Cluttered space
  ],
  after_living: [
    'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80', // Clean living room
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80', // Organized space
  ],
};

// Professional cleaner profile photos (diverse, professional-looking)
const CLEANER_AVATARS = [
  'https://images.unsplash.com/photo-1494790108755-2616b25ca02c?w=150&q=80', // Sarah
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=150&q=80', // Maria
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&q=80', // Jennifer
  'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=150&q=80', // Michael
  'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=150&q=80', // Lisa
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80', // David
];

// Mock cleaners with realistic data
export const MOCK_CLEANERS: CleanerWithDistance[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    phone: '+15551234567',
    email: 'sarah@chorehero.com',
    avatar_url: CLEANER_AVATARS[0],
    role: 'cleaner',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    video_profile_url: CLEANING_VIDEOS[0],
    verification_status: 'verified',
    background_check_date: '2024-01-01',
    rating_average: 4.9,
    total_jobs: 127,
    earnings_total: 15000,
    availability_schedule: [],
    service_areas: [],
    specialties: ['Deep cleaning', 'Eco-friendly', 'Kitchen specialist'],
    hourly_rate: 35,
    distance_km: 1.2,
    before_photos: CLEANING_PHOTOS.before_kitchen.slice(0, 2),
    after_photos: CLEANING_PHOTOS.after_kitchen.slice(0, 2),
  },
  {
    id: '2',
    name: 'Maria Rodriguez',
    phone: '+15551234568',
    email: 'maria@chorehero.com',
    avatar_url: CLEANER_AVATARS[1],
    role: 'cleaner',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    video_profile_url: CLEANING_VIDEOS[1],
    verification_status: 'verified',
    background_check_date: '2024-01-01',
    rating_average: 4.8,
    total_jobs: 89,
    earnings_total: 12000,
    availability_schedule: [],
    service_areas: [],
    specialties: ['Move-in/out', 'Organization', 'Bathroom specialist'],
    hourly_rate: 40,
    distance_km: 2.1,
    before_photos: CLEANING_PHOTOS.before_bathroom,
    after_photos: CLEANING_PHOTOS.after_bathroom,
  },
  {
    id: '3',
    name: 'Jennifer Chen',
    phone: '+15551234569',
    email: 'jennifer@chorehero.com',
    avatar_url: CLEANER_AVATARS[2],
    role: 'cleaner',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    video_profile_url: CLEANING_VIDEOS[2],
    verification_status: 'verified',
    background_check_date: '2024-01-01',
    rating_average: 4.95,
    total_jobs: 203,
    earnings_total: 22000,
    availability_schedule: [],
    service_areas: [],
    specialties: ['Regular cleaning', 'Pet-friendly', 'Green products'],
    hourly_rate: 38,
    distance_km: 0.8,
    before_photos: CLEANING_PHOTOS.before_living,
    after_photos: CLEANING_PHOTOS.after_living,
  },
  {
    id: '4',
    name: 'Michael Thompson',
    phone: '+15551234570',
    email: 'michael@chorehero.com',
    avatar_url: CLEANER_AVATARS[3],
    role: 'cleaner',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    video_profile_url: CLEANING_VIDEOS[3],
    verification_status: 'verified',
    background_check_date: '2024-01-01',
    rating_average: 4.7,
    total_jobs: 156,
    earnings_total: 18000,
    availability_schedule: [],
    service_areas: [],
    specialties: ['Window cleaning', 'Carpet cleaning', 'Office cleaning'],
    hourly_rate: 42,
    distance_km: 3.5,
    before_photos: CLEANING_PHOTOS.before_kitchen.slice(1),
    after_photos: CLEANING_PHOTOS.after_kitchen.slice(1),
  },
  {
    id: '5',
    name: 'Lisa Patel',
    phone: '+15551234571',
    email: 'lisa@chorehero.com',
    avatar_url: CLEANER_AVATARS[4],
    role: 'cleaner',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    video_profile_url: CLEANING_VIDEOS[4],
    verification_status: 'verified',
    background_check_date: '2024-01-01',
    rating_average: 4.85,
    total_jobs: 94,
    earnings_total: 11000,
    availability_schedule: [],
    service_areas: [],
    specialties: ['Post-construction', 'Deep clean', 'Move-in ready'],
    hourly_rate: 45,
    distance_km: 2.8,
    before_photos: [...CLEANING_PHOTOS.before_bathroom, ...CLEANING_PHOTOS.before_kitchen.slice(0, 1)],
    after_photos: [...CLEANING_PHOTOS.after_bathroom, ...CLEANING_PHOTOS.after_kitchen.slice(0, 1)],
  },
];

// Mock customer reviews with cleaning-specific content
export const MOCK_REVIEWS = [
  {
    id: '1',
    customer_name: 'Emily Davis',
    cleaner_id: '1',
    rating: 5,
    comment: "Sarah did an incredible job! My kitchen looks brand new. She even organized my pantry without me asking. Will definitely book again!",
    before_photos: CLEANING_PHOTOS.before_kitchen.slice(0, 1),
    after_photos: CLEANING_PHOTOS.after_kitchen.slice(0, 1),
    created_at: '2024-01-15T00:00:00Z',
  },
  {
    id: '2',
    customer_name: 'Robert Kim',
    cleaner_id: '2',
    rating: 5,
    comment: "Maria helped us with our move-out cleaning. She was thorough, professional, and the apartment looked perfect for our deposit return.",
    before_photos: CLEANING_PHOTOS.before_bathroom,
    after_photos: CLEANING_PHOTOS.after_bathroom,
    created_at: '2024-01-12T00:00:00Z',
  },
  {
    id: '3',
    customer_name: 'Amanda Johnson',
    cleaner_id: '3',
    rating: 5,
    comment: "Jennifer is amazing with pets! She cleaned around my cats without disturbing them and used pet-safe products. Highly recommend!",
    before_photos: CLEANING_PHOTOS.before_living.slice(0, 1),
    after_photos: CLEANING_PHOTOS.after_living.slice(0, 1),
    created_at: '2024-01-10T00:00:00Z',
  },
];

// Mock booking data for tracking/history
export const MOCK_BOOKINGS = [
  {
    id: '1',
    customer_id: 'demo-customer',
    cleaner_id: '1',
    cleaner_name: 'Sarah Johnson',
    service_type: 'express',
    status: 'in_progress',
    scheduled_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
    total_amount: 85,
    address: '123 Demo Street, San Francisco, CA',
    before_photos: CLEANING_PHOTOS.before_kitchen.slice(0, 2),
    after_photos: [], // Will be added when complete
  },
  {
    id: '2',
    customer_id: 'demo-customer',
    cleaner_id: '2',
    cleaner_name: 'Maria Rodriguez',
    service_type: 'standard',
    status: 'completed',
    scheduled_time: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    total_amount: 120,
    address: '456 Demo Avenue, San Francisco, CA',
    before_photos: CLEANING_PHOTOS.before_bathroom,
    after_photos: CLEANING_PHOTOS.after_bathroom,
  },
];

// Helper function to get random cleaning tip
export const getRandomCleaningTip = (): string => {
  const tips = [
    "💡 Pro tip: Clean from top to bottom to avoid re-cleaning surfaces!",
    "🌿 Mix baking soda with vinegar for a natural, powerful cleaner",
    "⏰ Set a timer for 15-minute cleaning sprints - you'll be amazed what you accomplish!",
    "🧽 Microfiber cloths are your best friend - they trap dirt better than regular rags",
    "🚿 Clean your shower while it's still warm and steamy for easier soap scum removal",
    "🍋 Use lemon to remove hard water stains and leave everything smelling fresh",
    "📱 Play upbeat music while cleaning - it makes time fly and keeps energy high!",
  ];
  return tips[Math.floor(Math.random() * tips.length)];
};

// Helper function to get mock location data
export const getMockLocationData = () => ({
  latitude: 37.7749 + (Math.random() - 0.5) * 0.1, // SF area
  longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
  accuracy: 5 + Math.random() * 10,
  heading: Math.random() * 360,
  speed: Math.random() * 25, // mph
  timestamp: new Date().toISOString(),
});

export default {
  MOCK_CLEANERS,
  MOCK_REVIEWS,
  MOCK_BOOKINGS,
  CLEANING_PHOTOS,
  getRandomCleaningTip,
  getMockLocationData,
}; 