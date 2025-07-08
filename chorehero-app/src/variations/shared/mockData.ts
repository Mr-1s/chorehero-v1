import { Cleaner, TimeSlot } from './types';

// Mock video URLs with fallbacks for better reliability
const mockVideoUrls = {
  primary: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
  ],
  testimonials: [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4'
  ],
  fallback: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
};

// Create cleaning-themed video descriptions
const cleaningVideoDescriptions = [
  'Professional deep cleaning demonstration',
  'Kitchen sanitization process',
  'Bathroom cleaning techniques',
  'Eco-friendly cleaning methods',
  'Before and after transformation'
];

export const mockCleaners: Cleaner[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    rating: 4.9,
    reviews: 127,
    price: 45,
    distance: '0.8 mi',
    videoUrl: mockVideoUrls.primary[0],
    videoThumbnail: 'https://images.unsplash.com/photo-1594736797933-d0601ba22280?w=400&h=300&fit=crop',
    bio: 'Professional cleaner with 5+ years experience. Specializing in deep cleaning and eco-friendly products.',
    verified: true,
    backgroundCheck: true,
    insured: true,
    expressClean: true,
    availability: ['today', 'tomorrow', 'this-week'],
    specialties: ['Deep Cleaning', 'Eco-Friendly', 'Pet-Friendly'],
    customerVideos: [
      mockVideoUrls.testimonials[0],
      mockVideoUrls.testimonials[1]
    ],
    yearsExperience: 5,
    responseTime: '< 10 min',
    completedJobs: 342,
    profileImage: 'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=400&h=400&fit=crop'
  },
  {
    id: '2',
    name: 'Michael Chen',
    rating: 4.8,
    reviews: 89,
    price: 38,
    distance: '1.2 mi',
    videoUrl: mockVideoUrls.primary[1],
    videoThumbnail: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
    bio: 'Detail-oriented cleaner focusing on residential and small office spaces. Quick turnaround guaranteed.',
    verified: true,
    backgroundCheck: true,
    insured: true,
    expressClean: true,
    availability: ['today', 'tomorrow'],
    specialties: ['Office Cleaning', 'Kitchen Deep Clean', 'Bathroom Sanitization'],
    customerVideos: [
      mockVideoUrls.testimonials[2]
    ],
    yearsExperience: 3,
    responseTime: '< 15 min',
    completedJobs: 189,
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'
  },
  {
    id: '3',
    name: 'Emily Rodriguez',
    rating: 4.95,
    reviews: 203,
    price: 52,
    distance: '0.5 mi',
    videoUrl: mockVideoUrls.primary[2],
    videoThumbnail: 'https://images.unsplash.com/photo-1527515862127-a4fc05baf7a5?w=400&h=300&fit=crop',
    bio: 'Premium cleaning service with attention to detail. Trusted by luxury home owners across the city.',
    verified: true,
    backgroundCheck: true,
    insured: true,
    expressClean: false,
    availability: ['tomorrow', 'this-week'],
    specialties: ['Luxury Homes', 'Delicate Surfaces', 'Organizing'],
    customerVideos: [
      mockVideoUrls.testimonials[3],
      mockVideoUrls.testimonials[0],
      mockVideoUrls.primary[0]
    ],
    yearsExperience: 8,
    responseTime: '< 5 min',
    completedJobs: 567,
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop'
  },
  {
    id: '4',
    name: 'David Kim',
    rating: 4.7,
    reviews: 156,
    price: 41,
    distance: '1.8 mi',
    videoUrl: mockVideoUrls.primary[3],
    videoThumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    bio: 'Reliable and efficient cleaning service. Same-day availability for urgent cleaning needs.',
    verified: true,
    backgroundCheck: true,
    insured: true,
    expressClean: true,
    availability: ['today', 'tomorrow', 'this-week'],
    specialties: ['Same-Day Service', 'Move-in/Move-out', 'Post-Construction'],
    customerVideos: [
      mockVideoUrls.testimonials[1]
    ],
    yearsExperience: 4,
    responseTime: '< 20 min',
    completedJobs: 278,
    profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop'
  },
  {
    id: '5',
    name: 'Lisa Thompson',
    rating: 4.85,
    reviews: 94,
    price: 48,
    distance: '2.1 mi',
    videoUrl: mockVideoUrls.primary[4],
    videoThumbnail: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=300&fit=crop',
    bio: 'Green cleaning specialist using only eco-friendly products. Perfect for families with children and pets.',
    verified: true,
    backgroundCheck: true,
    insured: true,
    expressClean: true,
    availability: ['tomorrow', 'this-week'],
    specialties: ['Eco-Friendly', 'Child-Safe Products', 'Pet-Friendly'],
    customerVideos: [
      mockVideoUrls.testimonials[2],
      mockVideoUrls.testimonials[3]
    ],
    yearsExperience: 6,
    responseTime: '< 12 min',
    completedJobs: 156,
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b417?w=400&h=400&fit=crop'
  }
];

export const mockTimeSlots: TimeSlot[] = [
  { id: '1', time: '9:00 AM', available: true, isExpress: true },
  { id: '2', time: '10:00 AM', available: true, isExpress: true },
  { id: '3', time: '11:00 AM', available: false, isExpress: false },
  { id: '4', time: '12:00 PM', available: true, isExpress: false },
  { id: '5', time: '1:00 PM', available: true, isExpress: true },
  { id: '6', time: '2:00 PM', available: true, isExpress: true },
  { id: '7', time: '3:00 PM', available: false, isExpress: false },
  { id: '8', time: '4:00 PM', available: true, isExpress: false },
  { id: '9', time: '5:00 PM', available: true, isExpress: true },
  { id: '10', time: '6:00 PM', available: true, isExpress: false }
];

export const mockCustomerTestimonials = [
  {
    id: '1',
    customerName: 'Jennifer L.',
    rating: 5,
    text: 'Sarah did an amazing job! My apartment has never looked better.',
    videoUrl: mockVideoUrls.testimonials[0],
    cleanerId: '1',
    beforeImage: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
    afterImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop'
  },
  {
    id: '2',
    customerName: 'Mark S.',
    rating: 5,
    text: 'Professional, punctual, and thorough. Highly recommend!',
    videoUrl: mockVideoUrls.testimonials[1],
    cleanerId: '2',
    beforeImage: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop',
    afterImage: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
  },
  {
    id: '3',
    customerName: 'Amanda R.',
    rating: 5,
    text: 'Emily transformed my home completely. The attention to detail was incredible!',
    videoUrl: mockVideoUrls.testimonials[2],
    cleanerId: '3',
    beforeImage: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop',
    afterImage: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop'
  },
  {
    id: '4',
    customerName: 'Robert T.',
    rating: 5,
    text: 'David cleaned our office space perfectly. Very professional and efficient!',
    videoUrl: mockVideoUrls.testimonials[3],
    cleanerId: '4',
    beforeImage: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=400&h=300&fit=crop',
    afterImage: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=300&fit=crop'
  }
];

// Export video utility functions
export const getVideoUrl = (index: number, type: 'primary' | 'testimonials' = 'primary'): string => {
  const urls = mockVideoUrls[type];
  if (index < urls.length) {
    return urls[index];
  }
  return mockVideoUrls.fallback;
};

export const getRandomVideoUrl = (type: 'primary' | 'testimonials' = 'primary'): string => {
  const urls = mockVideoUrls[type];
  const randomIndex = Math.floor(Math.random() * urls.length);
  return urls[randomIndex];
};