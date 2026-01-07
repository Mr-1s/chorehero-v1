export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          phone: string
          email: string | null
          name: string
          avatar_url: string | null
          role: 'customer' | 'cleaner'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          phone: string
          email?: string | null
          name: string
          avatar_url?: string | null
          role: 'customer' | 'cleaner'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone?: string
          email?: string | null
          name?: string
          avatar_url?: string | null
          role?: 'customer' | 'cleaner'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      customer_profiles: {
        Row: {
          user_id: string
          preferred_language: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          special_preferences: string | null
          total_bookings: number
          total_spent: number
          average_rating: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          preferred_language?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          special_preferences?: string | null
          total_bookings?: number
          total_spent?: number
          average_rating?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          preferred_language?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          special_preferences?: string | null
          total_bookings?: number
          total_spent?: number
          average_rating?: number
          created_at?: string
          updated_at?: string
        }
      }
      cleaner_profiles: {
        Row: {
          user_id: string
          video_profile_url: string | null
          verification_status: 'pending' | 'verified' | 'rejected'
          background_check_date: string | null
          background_check_provider: string | null
          rating_average: number
          rating_count: number
          total_jobs: number
          total_earnings: number
          hourly_rate: number
          bio: string | null
          years_experience: number | null
          specialties: string[] | null
          service_radius_km: number
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean
          is_available: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          video_profile_url?: string | null
          verification_status?: 'pending' | 'verified' | 'rejected'
          background_check_date?: string | null
          background_check_provider?: string | null
          rating_average?: number
          rating_count?: number
          total_jobs?: number
          total_earnings?: number
          hourly_rate: number
          bio?: string | null
          years_experience?: number | null
          specialties?: string[] | null
          service_radius_km?: number
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          video_profile_url?: string | null
          verification_status?: 'pending' | 'verified' | 'rejected'
          background_check_date?: string | null
          background_check_provider?: string | null
          rating_average?: number
          rating_count?: number
          total_jobs?: number
          total_earnings?: number
          hourly_rate?: number
          bio?: string | null
          years_experience?: number | null
          specialties?: string[] | null
          service_radius_km?: number
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean
          is_available?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      bookings: {
        Row: {
          id: string
          customer_id: string
          cleaner_id: string | null
          service_type: 'express' | 'standard' | 'deep'
          status: 'pending' | 'confirmed' | 'cleaner_assigned' | 'cleaner_en_route' | 'cleaner_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'payment_failed'
          address_id: string
          scheduled_time: string
          estimated_duration: number
          actual_start_time: string | null
          actual_end_time: string | null
          special_instructions: string | null
          access_instructions: string | null
          service_base_price: number
          add_ons_total: number
          platform_fee: number
          tax: number
          tip: number
          total_amount: number
          cleaner_earnings: number | null
          before_photos: string[] | null
          after_photos: string[] | null
          stripe_payment_intent_id: string | null
          payment_status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          cleaner_id?: string | null
          service_type: 'express' | 'standard' | 'deep'
          status?: 'pending' | 'confirmed' | 'cleaner_assigned' | 'cleaner_en_route' | 'cleaner_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'payment_failed'
          address_id: string
          scheduled_time: string
          estimated_duration: number
          actual_start_time?: string | null
          actual_end_time?: string | null
          special_instructions?: string | null
          access_instructions?: string | null
          service_base_price: number
          add_ons_total?: number
          platform_fee: number
          tax?: number
          tip?: number
          total_amount: number
          cleaner_earnings?: number | null
          before_photos?: string[] | null
          after_photos?: string[] | null
          stripe_payment_intent_id?: string | null
          payment_status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          cleaner_id?: string | null
          service_type?: 'express' | 'standard' | 'deep'
          status?: 'pending' | 'confirmed' | 'cleaner_assigned' | 'cleaner_en_route' | 'cleaner_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'payment_failed'
          address_id?: string
          scheduled_time?: string
          estimated_duration?: number
          actual_start_time?: string | null
          actual_end_time?: string | null
          special_instructions?: string | null
          access_instructions?: string | null
          service_base_price?: number
          add_ons_total?: number
          platform_fee?: number
          tax?: number
          tip?: number
          total_amount?: number
          cleaner_earnings?: number | null
          before_photos?: string[] | null
          after_photos?: string[] | null
          stripe_payment_intent_id?: string | null
          payment_status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
          created_at?: string
          updated_at?: string
        }
      }
      addresses: {
        Row: {
          id: string
          user_id: string
          street: string
          city: string
          state: string
          zip_code: string
          country: string
          latitude: number | null
          longitude: number | null
          is_default: boolean
          nickname: string | null
          access_instructions: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          street: string
          city: string
          state: string
          zip_code: string
          country?: string
          latitude?: number | null
          longitude?: number | null
          is_default?: boolean
          nickname?: string | null
          access_instructions?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          street?: string
          city?: string
          state?: string
          zip_code?: string
          country?: string
          latitude?: number | null
          longitude?: number | null
          is_default?: boolean
          nickname?: string | null
          access_instructions?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          thread_id: string
          sender_id: string
          message_type: 'text' | 'image' | 'location' | 'system'
          content: string
          metadata: Json | null
          is_read: boolean
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          sender_id: string
          message_type?: 'text' | 'image' | 'location' | 'system'
          content: string
          metadata?: Json | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          sender_id?: string
          message_type?: 'text' | 'image' | 'location' | 'system'
          content?: string
          metadata?: Json | null
          is_read?: boolean
          read_at?: string | null
          created_at?: string
        }
      }
      ratings: {
        Row: {
          id: string
          booking_id: string
          rater_id: string
          rated_id: string
          rating: number
          comment: string | null
          video_testimonial_url: string | null
          communication_rating: number | null
          timeliness_rating: number | null
          quality_rating: number | null
          professionalism_rating: number | null
          is_visible: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          rater_id: string
          rated_id: string
          rating: number
          comment?: string | null
          video_testimonial_url?: string | null
          communication_rating?: number | null
          timeliness_rating?: number | null
          quality_rating?: number | null
          professionalism_rating?: number | null
          is_visible?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          rater_id?: string
          rated_id?: string
          rating?: number
          comment?: string | null
          video_testimonial_url?: string | null
          communication_rating?: number | null
          timeliness_rating?: number | null
          quality_rating?: number | null
          professionalism_rating?: number | null
          is_visible?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_available_cleaners: {
        Args: {
          customer_lat: number
          customer_lng: number
          service_time: string
          radius_km?: number
        }
        Returns: {
          cleaner_id: string
          name: string
          rating_average: number
          hourly_rate: number
          distance_km: number
          video_profile_url: string
          specialties: string[]
        }[]
      }
      calculate_booking_total: {
        Args: {
          service_base_price: number
          add_ons_total: number
          tip_amount?: number
        }
        Returns: {
          platform_fee: number
          tax: number
          total_amount: number
          cleaner_earnings: number
        }[]
      }
    }
    Enums: {
      user_role: 'customer' | 'cleaner'
      verification_status: 'pending' | 'verified' | 'rejected'
      service_type: 'express' | 'standard' | 'deep'
      booking_status: 'pending' | 'confirmed' | 'cleaner_assigned' | 'cleaner_en_route' | 'cleaner_arrived' | 'in_progress' | 'completed' | 'cancelled' | 'payment_failed'
      message_type: 'text' | 'image' | 'location' | 'system'
      payment_status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded'
    }
  }
}