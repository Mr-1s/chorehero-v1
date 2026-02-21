-- Initial migration for ChoreHero database
-- Run this file to set up the complete database schema
-- Note: \i is psql-only; Supabase migrations require inline SQL. Content from schema.sql and rls_policies.sql inlined below.

-- ============================================================================
-- SCHEMA (from schema.sql)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Idempotent: skip if types already exist (e.g. DB was set up manually)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'cleaner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('express', 'standard', 'deep');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route',
    'cleaner_arrived', 'in_progress', 'completed', 'cancelled', 'payment_failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE message_type AS ENUM ('text', 'image', 'location', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'succeeded', 'failed', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS public.users (
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

CREATE TABLE IF NOT EXISTS public.customer_profiles (
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

CREATE TABLE IF NOT EXISTS public.cleaner_profiles (
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
  specialties TEXT[],
  service_radius_km INTEGER DEFAULT 15,
  stripe_account_id VARCHAR(100),
  stripe_onboarding_complete BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  zip_code VARCHAR(20) NOT NULL,
  country VARCHAR(50) DEFAULT 'US',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location GEOGRAPHY(POINT),
  is_default BOOLEAN DEFAULT false,
  nickname VARCHAR(50),
  access_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  stripe_payment_method_id VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  last_four VARCHAR(4),
  brand VARCHAR(20),
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type service_type NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price DECIMAL(8,2) NOT NULL,
  estimated_duration INTEGER NOT NULL,
  included_tasks TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.add_ons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(8,2) NOT NULL,
  estimated_time_minutes INTEGER NOT NULL,
  category VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  cleaner_id UUID REFERENCES public.users(id),
  service_type service_type NOT NULL,
  status booking_status DEFAULT 'pending',
  address_id UUID REFERENCES public.addresses(id) NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  estimated_duration INTEGER NOT NULL,
  actual_start_time TIMESTAMP WITH TIME ZONE,
  actual_end_time TIMESTAMP WITH TIME ZONE,
  special_instructions TEXT,
  access_instructions TEXT,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  square_feet INTEGER,
  has_pets BOOLEAN,
  pet_details TEXT,
  service_base_price DECIMAL(8,2) NOT NULL,
  add_ons_total DECIMAL(8,2) DEFAULT 0.00,
  platform_fee DECIMAL(8,2) NOT NULL,
  tax DECIMAL(8,2) DEFAULT 0.00,
  tip DECIMAL(8,2) DEFAULT 0.00,
  total_amount DECIMAL(8,2) NOT NULL,
  cleaner_earnings DECIMAL(8,2),
  before_photos TEXT[],
  after_photos TEXT[],
  stripe_payment_intent_id VARCHAR(100),
  payment_status payment_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.booking_add_ons (
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  add_on_id UUID REFERENCES public.add_ons(id),
  quantity INTEGER DEFAULT 1,
  price_per_unit DECIMAL(8,2) NOT NULL,
  PRIMARY KEY (booking_id, add_on_id)
);

CREATE TABLE IF NOT EXISTS public.cleaner_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(cleaner_id, day_of_week, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.location_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  location GEOGRAPHY(POINT),
  accuracy DECIMAL(8,2),
  heading DECIMAL(5,2),
  speed DECIMAL(5,2),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT UNIQUE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  cleaner_id UUID REFERENCES public.users(id) NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  message_type message_type DEFAULT 'text',
  content TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  rater_id UUID REFERENCES public.users(id) NOT NULL,
  rated_id UUID REFERENCES public.users(id) NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  video_testimonial_url TEXT,
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  professionalism_rating INTEGER CHECK (professionalism_rating >= 1 AND professionalism_rating <= 5),
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id, rater_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_cleaner_id ON public.bookings(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_time ON public.bookings(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_location ON public.addresses USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_location_updates_booking_id ON public.location_updates(booking_id);
CREATE INDEX IF NOT EXISTS idx_location_updates_location ON public.location_updates USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_id ON public.ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread ON public.notifications(user_id, is_read);

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON public.customer_profiles;
CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_cleaner_profiles_updated_at ON public.cleaner_profiles;
CREATE TRIGGER update_cleaner_profiles_updated_at BEFORE UPDATE ON public.cleaner_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses;
CREATE TRIGGER update_addresses_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON public.chat_threads;
CREATE TRIGGER update_chat_threads_updated_at BEFORE UPDATE ON public.chat_threads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION calculate_distance_km(lat1 DECIMAL, lon1 DECIMAL, lat2 DECIMAL, lon2 DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  RETURN ST_Distance(
    ST_SetSRID(ST_MakePoint(lon1, lat1), 4326)::geography,
    ST_SetSRID(ST_MakePoint(lon2, lat2), 4326)::geography
  ) / 1000;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS (only tables that exist in this migration; content_posts etc. in 004)
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users can view others basic info" ON public.users;
CREATE POLICY "Users can view others basic info" ON public.users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can create profile" ON public.users;
CREATE POLICY "Authenticated users can create profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Customers can manage own profile" ON public.customer_profiles;
CREATE POLICY "Customers can manage own profile" ON public.customer_profiles FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Cleaners can view customer profiles for bookings" ON public.customer_profiles;
CREATE POLICY "Cleaners can view customer profiles for bookings" ON public.customer_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.customer_id = customer_profiles.user_id AND bookings.cleaner_id = auth.uid())
);

DROP POLICY IF EXISTS "Cleaners can manage own profile" ON public.cleaner_profiles;
CREATE POLICY "Cleaners can manage own profile" ON public.cleaner_profiles FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public can view verified cleaners" ON public.cleaner_profiles;
CREATE POLICY "Public can view verified cleaners" ON public.cleaner_profiles FOR SELECT USING (verification_status = 'verified');
DROP POLICY IF EXISTS "Customers can view cleaner profiles for bookings" ON public.cleaner_profiles;
CREATE POLICY "Customers can view cleaner profiles for bookings" ON public.cleaner_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.cleaner_id = cleaner_profiles.user_id AND bookings.customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can manage own addresses" ON public.addresses;
CREATE POLICY "Users can manage own addresses" ON public.addresses FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Cleaners can view booking addresses" ON public.addresses;
CREATE POLICY "Cleaners can view booking addresses" ON public.addresses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.address_id = addresses.id AND bookings.cleaner_id = auth.uid())
);

DROP POLICY IF EXISTS "Customers can manage own bookings" ON public.bookings;
CREATE POLICY "Customers can manage own bookings" ON public.bookings FOR ALL USING (auth.uid() = customer_id);
DROP POLICY IF EXISTS "Cleaners can manage assigned bookings" ON public.bookings;
CREATE POLICY "Cleaners can manage assigned bookings" ON public.bookings FOR SELECT USING (auth.uid() = cleaner_id);
DROP POLICY IF EXISTS "Cleaners can update assigned bookings" ON public.bookings;
CREATE POLICY "Cleaners can update assigned bookings" ON public.bookings FOR UPDATE USING (auth.uid() = cleaner_id);
DROP POLICY IF EXISTS "Cleaners can view available bookings" ON public.bookings;
CREATE POLICY "Cleaners can view available bookings" ON public.bookings FOR SELECT USING (
  cleaner_id IS NULL AND status IN ('pending', 'confirmed') AND auth.uid() IN (SELECT id FROM public.users WHERE role = 'cleaner' AND is_active = true)
);

DROP POLICY IF EXISTS "Users can view booking add-ons" ON public.booking_add_ons;
CREATE POLICY "Users can view booking add-ons" ON public.booking_add_ons FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = booking_add_ons.booking_id AND (bookings.customer_id = auth.uid() OR bookings.cleaner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Customers can manage booking add-ons" ON public.booking_add_ons;
CREATE POLICY "Customers can manage booking add-ons" ON public.booking_add_ons FOR ALL USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = booking_add_ons.booking_id AND bookings.customer_id = auth.uid())
);

DROP POLICY IF EXISTS "Cleaners can manage own availability" ON public.cleaner_availability;
CREATE POLICY "Cleaners can manage own availability" ON public.cleaner_availability FOR ALL USING (auth.uid() = cleaner_id);
DROP POLICY IF EXISTS "Customers can view cleaner availability" ON public.cleaner_availability;
CREATE POLICY "Customers can view cleaner availability" ON public.cleaner_availability FOR SELECT USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'customer') AND is_available = true);

DROP POLICY IF EXISTS "Users can create own location updates" ON public.location_updates;
CREATE POLICY "Users can create own location updates" ON public.location_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view booking location updates" ON public.location_updates;
CREATE POLICY "Users can view booking location updates" ON public.location_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = location_updates.booking_id AND (bookings.customer_id = auth.uid() OR bookings.cleaner_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can view own chat threads" ON public.chat_threads;
CREATE POLICY "Users can view own chat threads" ON public.chat_threads FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = cleaner_id);
DROP POLICY IF EXISTS "Users can create chat threads" ON public.chat_threads;
CREATE POLICY "Users can create chat threads" ON public.chat_threads FOR INSERT WITH CHECK (
  (auth.uid() = customer_id OR auth.uid() = cleaner_id) AND EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = chat_threads.booking_id AND (bookings.customer_id = auth.uid() OR bookings.cleaner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Users can update own chat threads" ON public.chat_threads;
CREATE POLICY "Users can update own chat threads" ON public.chat_threads FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = cleaner_id);

DROP POLICY IF EXISTS "Users can view own chat messages" ON public.chat_messages;
CREATE POLICY "Users can view own chat messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.customer_id = auth.uid() OR chat_threads.cleaner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Users can send chat messages" ON public.chat_messages;
CREATE POLICY "Users can send chat messages" ON public.chat_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.customer_id = auth.uid() OR chat_threads.cleaner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Users can update chat messages" ON public.chat_messages;
CREATE POLICY "Users can update chat messages" ON public.chat_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.chat_threads WHERE chat_threads.id = chat_messages.thread_id AND (chat_threads.customer_id = auth.uid() OR chat_threads.cleaner_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can view booking ratings" ON public.ratings;
CREATE POLICY "Users can view booking ratings" ON public.ratings FOR SELECT USING (
  is_visible = true AND (auth.uid() = rater_id OR auth.uid() = rated_id OR EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = ratings.booking_id AND (bookings.customer_id = auth.uid() OR bookings.cleaner_id = auth.uid())))
);
DROP POLICY IF EXISTS "Users can create ratings" ON public.ratings;
CREATE POLICY "Users can create ratings" ON public.ratings FOR INSERT WITH CHECK (
  auth.uid() = rater_id AND EXISTS (SELECT 1 FROM public.bookings WHERE bookings.id = ratings.booking_id AND bookings.status = 'completed' AND (bookings.customer_id = auth.uid() OR bookings.cleaner_id = auth.uid()))
);
DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
CREATE POLICY "Users can update own ratings" ON public.ratings FOR UPDATE USING (auth.uid() = rater_id);
DROP POLICY IF EXISTS "Users can delete own ratings" ON public.ratings;
CREATE POLICY "Users can delete own ratings" ON public.ratings FOR DELETE USING (auth.uid() = rater_id);
DROP POLICY IF EXISTS "Public can view visible ratings" ON public.ratings;
CREATE POLICY "Public can view visible ratings" ON public.ratings FOR SELECT USING (is_visible = true);

DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view services" ON public.services;
CREATE POLICY "Public can view services" ON public.services FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Public can view add-ons" ON public.add_ons;
CREATE POLICY "Public can view add-ons" ON public.add_ons FOR SELECT USING (is_active = true);

-- Insert default service types (idempotent)
INSERT INTO public.services (type, name, description, base_price, estimated_duration, included_tasks) VALUES
('express', 'Express Clean', 'Quick 30-45 minute cleaning for maintenance', 45.00, 35, ARRAY[
  'Bathroom cleaning',
  'Kitchen surfaces', 
  'Vacuum main areas',
  'Trash removal'
]),
('standard', 'Standard Clean', 'Comprehensive cleaning for regular maintenance', 75.00, 90, ARRAY[
  'All Express Clean tasks',
  'Bedroom cleaning',
  'Dusting surfaces',
  'Mop floors',
  'Light organizing'
]),
('deep', 'Deep Clean', 'Thorough cleaning for move-in/out or special occasions', 150.00, 180, ARRAY[
  'All Standard Clean tasks',
  'Inside appliances',
  'Baseboards & windowsills', 
  'Interior windows',
  'Detailed organization'
])
ON CONFLICT (type) DO NOTHING;

-- Insert default add-ons (idempotent: only if empty)
INSERT INTO public.add_ons (name, description, price, estimated_time_minutes, category)
SELECT * FROM (VALUES
('Inside Fridge', 'Clean inside of refrigerator', 15.00, 15, 'cleaning'),
('Inside Oven', 'Clean inside of oven', 20.00, 20, 'cleaning'),
('Laundry Folding', 'Fold and organize clean laundry', 25.00, 30, 'organization'),
('Inside Cabinets', 'Clean inside kitchen cabinets', 30.00, 45, 'cleaning'),
('Garage Organization', 'Organize garage space', 50.00, 60, 'organization'),
('Window Cleaning (Interior)', 'Clean interior windows', 20.00, 25, 'cleaning'),
('Refrigerator Organization', 'Organize refrigerator contents', 15.00, 20, 'organization'),
('Closet Organization', 'Organize bedroom closets', 35.00, 45, 'organization')
) AS v(name, description, price, estimated_time_minutes, category)
WHERE (SELECT COUNT(*) FROM public.add_ons) = 0;

-- Create function to calculate booking totals
CREATE OR REPLACE FUNCTION calculate_booking_total(
  service_base_price DECIMAL,
  add_ons_total DECIMAL,
  tip_amount DECIMAL DEFAULT 0
)
RETURNS TABLE(
  platform_fee DECIMAL,
  tax DECIMAL,
  total_amount DECIMAL,
  cleaner_earnings DECIMAL
) AS $$
DECLARE
  subtotal DECIMAL;
  calculated_platform_fee DECIMAL;
  calculated_tax DECIMAL;
  calculated_total DECIMAL;
  calculated_cleaner_earnings DECIMAL;
BEGIN
  subtotal := service_base_price + add_ons_total;
  calculated_platform_fee := subtotal * 0.25; -- 25% platform fee
  calculated_tax := subtotal * 0.08; -- 8% tax (simplified)
  calculated_total := subtotal + calculated_platform_fee + calculated_tax + tip_amount;
  calculated_cleaner_earnings := subtotal * 0.70 + tip_amount; -- 70% to cleaner + tips
  
  RETURN QUERY SELECT 
    calculated_platform_fee,
    calculated_tax,
    calculated_total,
    calculated_cleaner_earnings;
END;
$$ LANGUAGE plpgsql;

-- Function to find available cleaners
CREATE OR REPLACE FUNCTION find_available_cleaners(
  customer_lat DECIMAL,
  customer_lng DECIMAL,
  service_time TIMESTAMP WITH TIME ZONE,
  radius_km INTEGER DEFAULT 25
)
RETURNS TABLE(
  cleaner_id UUID,
  name VARCHAR,
  rating_average DECIMAL,
  hourly_rate DECIMAL,
  distance_km DECIMAL,
  video_profile_url TEXT,
  specialties TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    cp.rating_average,
    cp.hourly_rate,
    calculate_distance_km(customer_lat, customer_lng, a.latitude, a.longitude) as distance_km,
    cp.video_profile_url,
    cp.specialties
  FROM public.users u
  JOIN public.cleaner_profiles cp ON u.id = cp.user_id
  JOIN public.addresses a ON u.id = a.user_id AND a.is_default = true
  WHERE u.role = 'cleaner'
    AND cp.verification_status = 'verified'
    AND cp.is_available = true
    AND u.is_active = true
    AND calculate_distance_km(customer_lat, customer_lng, a.latitude, a.longitude) <= radius_km
    -- Check availability for the requested time
    AND EXISTS (
      SELECT 1 FROM public.cleaner_availability ca
      WHERE ca.cleaner_id = u.id
        AND ca.day_of_week = EXTRACT(DOW FROM service_time)
        AND ca.start_time <= service_time::TIME
        AND ca.end_time >= service_time::TIME
        AND ca.is_available = true
    )
    -- Check no conflicting bookings
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.cleaner_id = u.id
        AND b.status IN ('confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress')
        AND b.scheduled_time <= service_time + INTERVAL '3 hours'
        AND b.scheduled_time + INTERVAL '1 hour' * b.estimated_duration / 60 >= service_time
    )
  ORDER BY distance_km ASC, cp.rating_average DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to update user ratings
CREATE OR REPLACE FUNCTION update_user_rating(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  avg_rating DECIMAL;
  rating_count INTEGER;
BEGIN
  SELECT 
    COALESCE(AVG(rating), 0)::DECIMAL(3,2),
    COUNT(*)
  INTO avg_rating, rating_count
  FROM public.ratings 
  WHERE rated_id = user_uuid AND is_visible = true;
  
  -- Update cleaner profile if user is a cleaner
  UPDATE public.cleaner_profiles 
  SET 
    rating_average = avg_rating,
    rating_count = rating_count,
    updated_at = NOW()
  WHERE user_id = user_uuid;
  
  -- Update customer profile if user is a customer
  UPDATE public.customer_profiles 
  SET 
    average_rating = avg_rating,
    updated_at = NOW()
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update ratings when a new rating is added
CREATE OR REPLACE FUNCTION trigger_update_rating()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_rating(NEW.rated_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_rating_insert
  AFTER INSERT ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rating();

CREATE TRIGGER after_rating_update
  AFTER UPDATE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rating();

-- Function to handle booking completion
CREATE OR REPLACE FUNCTION complete_booking(booking_uuid UUID)
RETURNS VOID AS $$
DECLARE
  booking_record RECORD;
BEGIN
  -- Get booking details
  SELECT * INTO booking_record FROM public.bookings WHERE id = booking_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Update booking status
  UPDATE public.bookings 
  SET 
    status = 'completed',
    actual_end_time = NOW(),
    updated_at = NOW()
  WHERE id = booking_uuid;
  
  -- Update cleaner stats
  UPDATE public.cleaner_profiles 
  SET 
    total_jobs = total_jobs + 1,
    total_earnings = total_earnings + booking_record.cleaner_earnings,
    updated_at = NOW()
  WHERE user_id = booking_record.cleaner_id;
  
  -- Update customer stats
  UPDATE public.customer_profiles 
  SET 
    total_bookings = total_bookings + 1,
    total_spent = total_spent + booking_record.total_amount,
    updated_at = NOW()
  WHERE user_id = booking_record.customer_id;
END;
$$ LANGUAGE plpgsql;

-- Realtime (idempotent: ignore if already in publication)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.location_updates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;