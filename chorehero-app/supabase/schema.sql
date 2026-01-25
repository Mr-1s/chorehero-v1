-- ChoreHero Database Schema
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create custom types
CREATE TYPE user_role AS ENUM ('customer', 'cleaner');
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE service_type AS ENUM ('express', 'standard', 'deep');
CREATE TYPE booking_status AS ENUM (
  'pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route', 
  'cleaner_arrived', 'in_progress', 'completed', 'cancelled', 'payment_failed'
);
CREATE TYPE message_type AS ENUM ('text', 'image', 'location', 'system');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255),
  name VARCHAR(100),
  avatar_url TEXT,
  role user_role,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customer-specific profile information
CREATE TABLE public.customer_profiles (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  preferred_language VARCHAR(10) DEFAULT 'en',
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  special_preferences TEXT,
  total_bookings INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cleaner-specific profile information
CREATE TABLE public.cleaner_profiles (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  video_profile_url TEXT,
  verification_status verification_status DEFAULT 'pending',
  background_check_date DATE,
  background_check_provider VARCHAR(50),
  rating_average DECIMAL(3,2) DEFAULT 0.00,
  rating_count INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0.00,
  hourly_rate DECIMAL(6,2) NOT NULL,
  bio TEXT,
  years_experience INTEGER,
  specialties TEXT[], -- Array of specialties
  service_radius_km INTEGER DEFAULT 15,
  stripe_account_id VARCHAR(100),
  stripe_onboarding_complete BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Addresses table
CREATE TABLE public.addresses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(50) DEFAULT 'US',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location GEOGRAPHY(POINT), -- PostGIS point for spatial queries
  is_default BOOLEAN DEFAULT false,
  nickname VARCHAR(50),
  access_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods table
CREATE TABLE public.payment_methods (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'card', 'bank_account'
  last_four VARCHAR(4),
  brand VARCHAR(20),
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Service definitions table
CREATE TABLE public.services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type service_type NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price DECIMAL(8,2) NOT NULL,
  estimated_duration INTEGER NOT NULL, -- in minutes
  included_tasks TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add-ons table
CREATE TABLE public.add_ons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(8,2) NOT NULL,
  estimated_time_minutes INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  cleaner_id UUID REFERENCES public.users(id),
  service_type service_type NOT NULL,
  status booking_status DEFAULT 'pending',
  address_id UUID REFERENCES public.addresses(id) NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_duration INTEGER NOT NULL, -- in minutes
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  special_instructions TEXT,
  access_instructions TEXT,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  square_feet INTEGER,
  has_pets BOOLEAN,
  pet_details TEXT,
  
  -- Pricing
  service_base_price DECIMAL(8,2) NOT NULL,
  add_ons_total DECIMAL(8,2) DEFAULT 0.00,
  platform_fee DECIMAL(8,2) NOT NULL,
  tax DECIMAL(8,2) DEFAULT 0.00,
  tip DECIMAL(8,2) DEFAULT 0.00,
  total_amount DECIMAL(8,2) NOT NULL,
  cleaner_earnings DECIMAL(8,2),
  
  -- Media
  before_photos TEXT[],
  after_photos TEXT[],
  
  -- Stripe integration
  stripe_payment_intent_id VARCHAR(100),
  payment_status payment_status DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Booking add-ons junction table
CREATE TABLE public.booking_add_ons (
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  add_on_id UUID REFERENCES public.add_ons(id),
  quantity INTEGER DEFAULT 1,
  price_per_unit DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (booking_id, add_on_id)
);

-- Cleaner availability table
CREATE TABLE public.cleaner_availability (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cleaner_id, day_of_week, start_time, end_time)
);

-- Location tracking table
CREATE TABLE public.location_updates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  location GEOGRAPHY(POINT), -- PostGIS point
  accuracy DECIMAL(8,2),
  heading DECIMAL(5,2),
  speed DECIMAL(5,2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat threads table
CREATE TABLE public.chat_threads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id TEXT UNIQUE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  cleaner_id UUID REFERENCES public.users(id) NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  thread_id UUID REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  message_type message_type DEFAULT 'text',
  content TEXT NOT NULL,
  metadata JSONB, -- For storing image URLs, location data, etc.
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ratings table
CREATE TABLE public.ratings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES public.users(id) NOT NULL, -- Who gave the rating
  rated_id UUID REFERENCES public.users(id) NOT NULL, -- Who received the rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  video_testimonial_url TEXT,
  
  -- Category ratings
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id, rater_id)
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB, -- Additional notification data
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX idx_bookings_cleaner_id ON public.bookings(cleaner_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_scheduled_time ON public.bookings(scheduled_time);
CREATE INDEX idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX idx_addresses_location ON public.addresses USING GIST(location);
CREATE INDEX idx_location_updates_booking_id ON public.location_updates(booking_id);
CREATE INDEX idx_location_updates_location ON public.location_updates USING GIST(location);
CREATE INDEX idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX idx_ratings_rated_id ON public.ratings(rated_id);
CREATE INDEX idx_notifications_user_id_unread ON public.notifications(user_id, is_read);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cleaner_profiles_updated_at BEFORE UPDATE ON public.cleaner_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance_km(lat1 DECIMAL, lon1 DECIMAL, lat2 DECIMAL, lon2 DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ST_Distance(
    ST_SetSRID(ST_MakePoint(lon1, lat1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)::geography
  ) / 1000; -- Convert meters to kilometers
END;
$$ LANGUAGE plpgsql;