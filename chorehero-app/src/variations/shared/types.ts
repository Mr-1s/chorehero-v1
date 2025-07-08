export interface Cleaner {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  price: number;
  distance: string;
  videoUrl: string;
  videoThumbnail: string;
  bio: string;
  verified: boolean;
  backgroundCheck: boolean;
  insured: boolean;
  expressClean: boolean;
  availability: string[];
  specialties: string[];
  customerVideos?: string[];
  yearsExperience: number;
  responseTime: string;
  completedJobs: number;
  profileImage: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
  isExpress: boolean;
}

export interface BookingData {
  cleanerId: string;
  date: string;
  timeSlot: TimeSlot;
  address: string;
  specialInstructions?: string;
  estimatedDuration: number;
  totalPrice: number;
}

export interface SwipeDirection {
  x: number;
  y: number;
  direction: 'left' | 'right' | 'up' | 'down' | null;
}