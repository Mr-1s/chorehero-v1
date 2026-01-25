/**
 * Cleaner-side shared types for ChoreHero
 */

// ============================================================================
// CLEANER
// ============================================================================

export interface Cleaner {
  id: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  totalJobs: number;
  hourlyRate?: number;
  specialties: string[];
  isOnline: boolean;
  profileCompletion: number; // 0-1
  weeklyEarnings: number;
  todayEarnings: number;
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  onboardingState?: string | null;
  backgroundCheckStatus?: string | null;
  videoProfileUrl?: string | null;
}

// ============================================================================
// BOOKING
// ============================================================================

export type BookingStatus = 
  | 'offered' 
  | 'accepted' 
  | 'on_the_way' 
  | 'in_progress' 
  | 'completed' 
  | 'cancelled';

export interface Booking {
  id: string;
  customerName: string;
  customerAvatarUrl?: string;
  customerRating?: number;
  customerTotalBookings?: number;
  serviceType: 'Standard Clean' | 'Deep Clean' | 'Express Clean' | string;
  addOns: string[];
  scheduledAt: string; // ISO
  durationMinutes: number;
  distanceMiles: number;
  addressLine1: string;
  isInstant: boolean;
  status: BookingStatus;
  payoutToCleaner: number; // cleaner earnings
  totalPrice: number; // customer paid
  hasSpecialRequests: boolean;
  specialRequestText?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  hasPets?: boolean | null;
  petDetails?: string | null;
  accessInstructions?: string | null;
}

// ============================================================================
// VIDEO STATS
// ============================================================================

export interface VideoStats {
  totalViews: number;
  bookingsFromVideos: number;
  conversionRate: number; // 0-1
  avgViewsPerVideo: number;
}

export interface VideoTip {
  id: string;
  text: string;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

export interface Conversation {
  id: string;
  participantName: string;
  participantAvatarUrl?: string;
  lastMessagePreview: string;
  lastMessageTime: string; // ISO
  unreadCount: number;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export type JobFilter = 'all' | 'today' | 'tomorrow' | 'week';
export type JobTab = 'available' | 'active' | 'history';

