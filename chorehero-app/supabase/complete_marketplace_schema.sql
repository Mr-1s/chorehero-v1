-- ChoreHero: Complete Social Service Marketplace Schema
-- TikTok meets Uber for cleaning services
-- Run this in your Supabase SQL Editor

-- ============================================================================
-- CORE USER SYSTEM
-- ============================================================================

-- Enhanced users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('customer', 'cleaner', 'admin')),
    is_active BOOLEAN DEFAULT true,
    profile_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer profiles (additional customer-specific data)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    preferred_payment_method TEXT,
    total_bookings INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cleaner profiles (additional cleaner-specific data)
CREATE TABLE IF NOT EXISTS public.cleaner_profiles (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
    bio TEXT,
    hourly_rate DECIMAL(10, 2) NOT NULL,
    service_radius_km INTEGER DEFAULT 25,
    specialties TEXT[],
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
    is_available BOOLEAN DEFAULT true,
    rating_average DECIMAL(3, 2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    total_earnings DECIMAL(10, 2) DEFAULT 0,
    background_check_status TEXT DEFAULT 'pending' CHECK (background_check_status IN ('pending', 'approved', 'failed')),
    insurance_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SERVICE CATEGORIES & OFFERINGS
-- ============================================================================

-- Service categories (e.g., "Deep Clean", "Regular Clean", "Move-out Clean")
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    base_price DECIMAL(10, 2),
    estimated_duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Services offered by cleaners
CREATE TABLE IF NOT EXISTS public.cleaner_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.service_categories(id) ON DELETE CASCADE,
    custom_price DECIMAL(10, 2), -- Override category base price
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cleaner_id, category_id)
);

-- ============================================================================
-- SOCIAL CONTENT SYSTEM (TikTok-like)
-- ============================================================================

-- Content posts (videos/images by cleaners)
CREATE TABLE IF NOT EXISTS public.content_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'image', 'before_after')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    secondary_media_url TEXT, -- For before/after posts
    duration_seconds INTEGER,
    location_name TEXT,
    service_category_id UUID REFERENCES public.service_categories(id),
    tags TEXT[],
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content interactions (likes, views, saves)
CREATE TABLE IF NOT EXISTS public.content_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'save', 'share')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_post_id, user_id, interaction_type)
);

-- Content views tracking
CREATE TABLE IF NOT EXISTS public.content_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    session_id TEXT, -- For anonymous views
    duration_seconds INTEGER,
    completed_view BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content comments
CREATE TABLE IF NOT EXISTS public.content_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_post_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- ============================================================================
-- BOOKING & SERVICE SYSTEM (Uber-like)
-- ============================================================================

-- Service bookings
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    service_category_id UUID REFERENCES public.service_categories(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed'
    )),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    estimated_duration_minutes INTEGER,
    estimated_price DECIMAL(10, 2) NOT NULL,
    final_price DECIMAL(10, 2),
    
    -- Address information
    service_address_line1 TEXT NOT NULL,
    service_address_line2 TEXT,
    service_city TEXT NOT NULL,
    service_state TEXT NOT NULL,
    service_zip_code TEXT NOT NULL,
    service_latitude DECIMAL(10, 8),
    service_longitude DECIMAL(11, 8),
    
    -- Special instructions
    special_instructions TEXT,
    access_instructions TEXT,
    
    -- Timing
    cleaner_arrived_at TIMESTAMPTZ,
    service_started_at TIMESTAMPTZ,
    service_completed_at TIMESTAMPTZ,
    
    -- Payment
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'authorized', 'captured', 'failed', 'refunded'
    )),
    payment_intent_id TEXT, -- Stripe payment intent
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking status history
CREATE TABLE IF NOT EXISTS public.booking_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    changed_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MESSAGING SYSTEM
-- ============================================================================

-- Chat rooms (conversations between users)
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participants UUID[] NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'booking_update', 'location')),
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL, -- For booking-related messages
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RATINGS & REVIEWS SYSTEM
-- ============================================================================

-- Reviews and ratings
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
    reviewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    reviewee_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    service_quality_rating INTEGER CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
    communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
    timeliness_rating INTEGER CHECK (timeliness_rating >= 1 AND timeliness_rating <= 5),
    would_recommend BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SOCIAL FEATURES
-- ============================================================================

-- User follows (social aspect)
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'booking_request', 'booking_accepted', 'booking_completed', 'new_review',
        'content_liked', 'new_follower', 'message_received', 'payment_received'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional context data
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYMENT & FINANCIAL TRACKING
-- ============================================================================

-- Payment transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    cleaner_earnings DECIMAL(10, 2) NOT NULL,
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cleaner earnings/payouts
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    stripe_transfer_id TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Content discovery indexes
CREATE INDEX IF NOT EXISTS idx_content_posts_published ON public.content_posts (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_content_posts_user_published ON public.content_posts (user_id, published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_content_posts_category ON public.content_posts (service_category_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_tags ON public.content_posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_content_posts_featured ON public.content_posts (is_featured, published_at DESC) WHERE is_featured = true;

-- Geolocation indexes
CREATE INDEX IF NOT EXISTS idx_customer_profiles_location ON public.customer_profiles (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_bookings_location ON public.bookings (service_latitude, service_longitude);

-- User discovery indexes
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_available ON public.cleaner_profiles (is_available, rating_average DESC) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_specialties ON public.cleaner_profiles USING GIN (specialties);

-- Booking indexes
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON public.bookings (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_cleaner ON public.bookings (cleaner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings (status, scheduled_date);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participants ON public.chat_rooms USING GIN (participants);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time ON public.chat_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON public.chat_messages (room_id, is_read) WHERE is_read = false;

-- Social indexes
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows (following_id);
CREATE INDEX IF NOT EXISTS idx_content_interactions_user ON public.content_interactions (user_id, interaction_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be customized based on your needs)

-- Users can read their own profile and public profiles
CREATE POLICY "Users can view profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Published content is publicly viewable
CREATE POLICY "Published content is public" ON public.content_posts FOR SELECT USING (status = 'published');
CREATE POLICY "Users can manage own content" ON public.content_posts FOR ALL USING (auth.uid() = user_id);

-- Users can view bookings they're involved in
CREATE POLICY "Users can view own bookings" ON public.bookings FOR SELECT USING (
    auth.uid() = customer_id OR auth.uid() = cleaner_id
);
CREATE POLICY "Users can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Users can update own bookings" ON public.bookings FOR UPDATE USING (
    auth.uid() = customer_id OR auth.uid() = cleaner_id
);

-- Chat access for participants only
CREATE POLICY "Users can access own chats" ON public.chat_rooms FOR ALL USING (
    auth.uid()::text = ANY(participants)
);
CREATE POLICY "Users can access own messages" ON public.chat_messages FOR ALL USING (
    auth.uid()::text IN (
        SELECT unnest(participants) FROM public.chat_rooms WHERE id = room_id
    )
);

-- Users can see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_profiles_updated_at BEFORE UPDATE ON public.customer_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cleaner_profiles_updated_at BEFORE UPDATE ON public.cleaner_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_posts_updated_at BEFORE UPDATE ON public.content_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_rooms_updated_at BEFORE UPDATE ON public.chat_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update chat room last message
CREATE OR REPLACE FUNCTION update_chat_room_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.chat_rooms 
    SET 
        last_message = NEW.content,
        last_message_at = NEW.created_at
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_room_last_message_trigger
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_chat_room_last_message();

-- Function to update content interaction counts
CREATE OR REPLACE FUNCTION update_content_interaction_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.content_posts 
        SET like_count = like_count + 1
        WHERE id = NEW.content_post_id AND NEW.interaction_type = 'like';
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.content_posts 
        SET like_count = GREATEST(like_count - 1, 0)
        WHERE id = OLD.content_post_id AND OLD.interaction_type = 'like';
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_like_counts
    AFTER INSERT OR DELETE ON public.content_interactions
    FOR EACH ROW EXECUTE FUNCTION update_content_interaction_counts();

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$ 
BEGIN 
    RAISE NOTICE '🎉 ChoreHero Social Service Marketplace Schema Created Successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Core Systems Implemented:';
    RAISE NOTICE '   - User Management (customers, cleaners, profiles)';
    RAISE NOTICE '   - Service Categories & Offerings';
    RAISE NOTICE '   - Social Content System (TikTok-like videos/posts)';
    RAISE NOTICE '   - Booking & Service Management (Uber-like)';
    RAISE NOTICE '   - Real-time Messaging';
    RAISE NOTICE '   - Reviews & Ratings';
    RAISE NOTICE '   - Social Features (follows, notifications)';
    RAISE NOTICE '   - Payment & Financial Tracking';
    RAISE NOTICE '   - Performance Indexes';
    RAISE NOTICE '   - Row Level Security';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Your marketplace is ready for users to join and start creating content!';
END $$;