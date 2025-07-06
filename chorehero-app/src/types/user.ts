export interface BaseUser {
  id: string;
  phone: string;
  email?: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Customer extends BaseUser {
  role: 'customer';
  addresses: Address[];
  payment_methods: PaymentMethod[];
  booking_history: string[]; // Booking IDs to avoid circular dependency
}

export interface Cleaner extends BaseUser {
  role: 'cleaner';
  video_profile_url: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  background_check_date?: string;
  rating_average: number;
  total_jobs: number;
  earnings_total: number;
  availability_schedule: AvailabilitySlot[];
  service_areas: ServiceArea[];
  specialties: string[];
  hourly_rate: number;
}

export interface Address {
  id: string;
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude: number;
  longitude: number;
  is_default: boolean;
  nickname?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last_four: string;
  brand?: string;
  is_default: boolean;
  stripe_payment_method_id: string;
}

export interface AvailabilitySlot {
  day_of_week: number; // 0-6, Sunday is 0
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  is_available: boolean;
}

export interface ServiceArea {
  id: string;
  name: string;
  boundary_coordinates: [number, number][]; // [lat, lng] pairs
  travel_time_minutes: number;
}

export type User = Customer | Cleaner;

export interface AuthUser {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}