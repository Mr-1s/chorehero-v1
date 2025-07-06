import { User, Customer, Cleaner } from './user';
import { Booking, BookingRequest, BookingResponse } from './booking';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Authentication API
export interface AuthRequest {
  phone: string;
  verification_code?: string;
}

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

// Cleaner Discovery API
export interface CleanerSearchRequest {
  latitude: number;
  longitude: number;
  radius_km?: number;
  service_type?: string;
  max_results?: number;
  available_at?: string;
  min_rating?: number;
  max_price?: number;
}

export interface CleanerSearchResponse {
  cleaners: Cleaner[];
  total_count: number;
  search_radius: number;
}

// Video API
export interface VideoUploadRequest {
  file: File | Blob;
  user_id: string;
  video_type: 'profile' | 'testimonial' | 'service_photo';
  duration_seconds?: number;
  thumbnail_timestamp?: number;
}

export interface VideoUploadResponse {
  video_url: string;
  thumbnail_url: string;
  upload_id: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Payment API
export interface PaymentRequest {
  booking_id: string;
  payment_method_id: string;
  amount: number;
  tip_amount?: number;
}

export interface PaymentResponse {
  payment_intent_id: string;
  client_secret: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'failed';
}

// Chat API
export interface ChatMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_type: 'customer' | 'cleaner' | 'system';
  message_type: 'text' | 'image' | 'location' | 'system';
  content: string;
  metadata?: Record<string, any>;
  timestamp: string;
  is_read: boolean;
}

export interface ChatThread {
  id: string;
  booking_id: string;
  participants: string[];
  last_message?: ChatMessage;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

// Rating API
export interface RatingRequest {
  booking_id: string;
  rating: number;
  comment?: string;
  video_testimonial_url?: string;
  categories?: {
    communication: number;
    timeliness: number;
    quality: number;
    professionalism: number;
  };
}

export interface RatingResponse {
  rating_id: string;
  updated_averages: {
    overall: number;
    communication: number;
    timeliness: number;
    quality: number;
    professionalism: number;
  };
}

// Real-time API
export interface LocationUpdateRequest {
  booking_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
}

export interface BookingStatusUpdate {
  booking_id: string;
  status: string;
  eta_minutes?: number;
  message?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// Stripe Connect API
export interface StripeConnectRequest {
  user_id: string;
  business_type: 'individual' | 'company';
  country: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  dob: {
    day: number;
    month: number;
    year: number;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

export interface StripeConnectResponse {
  account_id: string;
  onboarding_url: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  requirements: string[];
}