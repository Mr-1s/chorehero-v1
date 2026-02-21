export interface Booking {
  id: string;
  customer_id: string;
  cleaner_id: string;
  service_type: ServiceType;
  status: BookingStatus;
  address: Address;
  scheduled_time: string;
  estimated_duration: number;
  actual_start_time?: string;
  actual_end_time?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  price_breakdown: PriceBreakdown;
  add_ons: AddOn[];
  tracking_data?: LocationUpdate[];
  chat_thread_id: string;
  special_instructions?: string;
  access_instructions?: string;
  before_photos?: string[];
  after_photos?: string[];
  created_at: string;
  updated_at: string;
}

export type ServiceType = 'express' | 'standard' | 'deep';

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'cleaner_assigned'
  | 'cleaner_en_route'
  | 'cleaner_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'payment_failed';

export interface PriceBreakdown {
  service_base: number;
  add_ons_total: number;
  platform_fee: number;
  tip: number;
  tax: number;
  total: number;
  cleaner_earnings: number; // 70% of (service_base + add_ons_total)
}

export interface AddOn {
  id: string;
  name: string;
  description: string;
  price: number;
  estimated_time_minutes: number;
  category: 'cleaning' | 'organization' | 'special';
  is_selected: boolean;
}

export interface LocationUpdate {
  id: string;
  booking_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy: number;
  heading?: number;
  speed?: number;
}

export interface ServiceDefinition {
  type: ServiceType;
  name: string;
  description: string;
  base_price: number;
  estimated_duration: number;
  included_tasks: string[];
  popular_add_ons: string[];
}

export interface BookingRequest {
  customer_id: string;
  cleaner_id: string;
  service_type: ServiceType;
  address_id: string;
  scheduled_time: string;
  estimated_duration?: number;
  add_ons: string[];
  special_instructions?: string;
  access_instructions?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  has_pets?: boolean | null;
  pet_details?: string | null;
  payment_method_id: string;
  tip_amount?: number;
  /** Package (content_post) id when booking from video feed */
  package_id?: string;
  /** Override service base price (cents) when using package-based pricing */
  service_base_price_cents?: number;
}

export interface BookingResponse {
  booking: Booking;
  estimated_arrival: string;
  cleaner_info: {
    name: string;
    photo_url: string;
    rating: number;
    phone: string;
  };
  chat_thread_id: string;
}

import { Address } from './user';

export interface TimeSlot {
  datetime: string;
  is_available: boolean;
  price_modifier?: number; // e.g., 1.2 for peak hours
}