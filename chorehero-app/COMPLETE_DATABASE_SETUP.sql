-- ChoreHero Database Schema test"
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
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255),
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL,
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
  
  -- Content attribution (track which content led to this booking)
  -- Foreign key added after content_posts table is created
  source_content_id UUID,
  
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
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  cleaner_id UUID REFERENCES public.users(id) NOT NULL,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  thread_id UUID REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) NOT NULL,
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

-- User push tokens for notifications
CREATE TABLE public.user_push_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  push_token TEXT NOT NULL,
  platform VARCHAR(10) CHECK (platform IN ('ios', 'android', 'web')),
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_push_tokens_user_id ON public.user_push_tokens(user_id);
CREATE INDEX idx_user_push_tokens_active ON public.user_push_tokens(is_active);

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
$$ LANGUAGE plpgsql;-- Content Tables Migration (Standalone)
-- Add tables for User Generated Content (UGC) system

-- Content posts table for videos/photos uploaded by cleaners
CREATE TABLE IF NOT EXISTS public.content_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('video', 'photo', 'before_after')),
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  secondary_media_url TEXT, -- For before/after posts
  duration_seconds INTEGER, -- For videos
  location_name VARCHAR(255),
  tags TEXT[],
  status VARCHAR(20) DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content interactions (likes, views, etc.)
CREATE TABLE IF NOT EXISTS public.content_interactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
  interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('like', 'view', 'share')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, content_post_id, interaction_type)
);

-- Content comments
CREATE TABLE IF NOT EXISTS public.content_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
  parent_comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User follows (for following other cleaners)
CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

-- Content notifications
CREATE TABLE IF NOT EXISTS public.content_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  actor_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE,
  notification_type VARCHAR(30) NOT NULL CHECK (notification_type IN ('like', 'comment', 'follow', 'mention')),
  content TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_posts_user_id ON public.content_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON public.content_posts(status);
CREATE INDEX IF NOT EXISTS idx_content_posts_published_at ON public.content_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_posts_content_type ON public.content_posts(content_type);

CREATE INDEX IF NOT EXISTS idx_content_interactions_user_id ON public.content_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content_post_id ON public.content_interactions(content_post_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_type ON public.content_interactions(interaction_type);

CREATE INDEX IF NOT EXISTS idx_content_comments_content_post_id ON public.content_comments(content_post_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_user_id ON public.content_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_parent_id ON public.content_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON public.user_follows(following_id);

CREATE INDEX IF NOT EXISTS idx_content_notifications_user_id ON public.content_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_content_notifications_is_read ON public.content_notifications(is_read);

-- Add foreign key for booking content attribution (after content_posts exists)
ALTER TABLE public.bookings 
  ADD CONSTRAINT fk_bookings_source_content 
  FOREIGN KEY (source_content_id) 
  REFERENCES public.content_posts(id) 
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_source_content_id ON public.bookings(source_content_id);

-- RLS (Row Level Security) Policies
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_notifications ENABLE ROW LEVEL SECURITY;

-- Content posts policies
CREATE POLICY "Content posts are viewable by everyone" ON public.content_posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "Users can insert their own content posts" ON public.content_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own content posts" ON public.content_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content posts" ON public.content_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Content interactions policies
CREATE POLICY "Users can view all interactions" ON public.content_interactions
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own interactions" ON public.content_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions" ON public.content_interactions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" ON public.content_interactions
  FOR DELETE USING (auth.uid() = user_id);

-- Content comments policies
CREATE POLICY "Comments are viewable by everyone" ON public.content_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON public.content_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.content_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.content_comments
  FOR DELETE USING (auth.uid() = user_id);

-- User follows policies
CREATE POLICY "Users can view all follows" ON public.user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own follows" ON public.user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows" ON public.user_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Content notifications policies
CREATE POLICY "Users can view their own notifications" ON public.content_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.content_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_posts_updated_at BEFORE UPDATE ON public.content_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_comments_updated_at BEFORE UPDATE ON public.content_comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update content interaction counts
CREATE OR REPLACE FUNCTION update_content_counts()
RETURNS TRIGGER AS $$
BEGIN
  -- Update like count
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'like' THEN
    UPDATE public.content_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.content_post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.interaction_type = 'like' THEN
    UPDATE public.content_posts 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.content_post_id;
  END IF;
  
  -- Update view count
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'view' THEN
    UPDATE public.content_posts 
    SET view_count = view_count + 1 
    WHERE id = NEW.content_post_id;
  END IF;
  
  -- Update share count
  IF TG_OP = 'INSERT' AND NEW.interaction_type = 'share' THEN
    UPDATE public.content_posts 
    SET share_count = share_count + 1 
    WHERE id = NEW.content_post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_interaction_counts
  AFTER INSERT OR DELETE ON public.content_interactions
  FOR EACH ROW EXECUTE FUNCTION update_content_counts();

-- Function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.content_posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.content_post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.content_posts 
    SET comment_count = GREATEST(comment_count - 1, 0) 
    WHERE id = OLD.content_post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_comment_counts
  AFTER INSERT OR DELETE ON public.content_comments
  FOR EACH ROW EXECUTE FUNCTION update_comment_counts(); 