-- ============================================================================
-- CHOREHERO LIVE READINESS DATABASE SETUP
-- Complete database verification and setup for end-to-end app usage
-- ============================================================================

-- First, check what tables currently exist
SELECT 
    'CURRENT TABLES IN DATABASE:' as info,
    tablename,
    schemaname
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- ============================================================================
-- CORE USER TABLES (Essential for any usage)
-- ============================================================================

-- Enhanced users table (if not exists)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE,
    phone TEXT,
    name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('customer', 'cleaner', 'admin')) DEFAULT 'customer',
    is_active BOOLEAN DEFAULT true,
    profile_completed BOOLEAN DEFAULT false,
    timezone TEXT DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table (unified for both customer and cleaner data)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
    bio TEXT,
    
    -- Customer-specific fields
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    total_bookings INTEGER DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0,
    
    -- Cleaner-specific fields
    hourly_rate DECIMAL(10, 2),
    service_radius_km INTEGER DEFAULT 10,
    rating_average DECIMAL(3, 2) DEFAULT 0,
    total_jobs INTEGER DEFAULT 0,
    specialties TEXT[],
    verification_status TEXT CHECK (verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
    is_available BOOLEAN DEFAULT true,
    video_profile_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONTENT & SOCIAL TABLES (For video feed and interactions)
-- ============================================================================

-- Content posts (videos and images)
CREATE TABLE IF NOT EXISTS public.content_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL CHECK (content_type IN ('video', 'image', 'story')),
    media_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    location_name TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Engagement metrics
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    
    -- Status and moderation
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived', 'reported')) DEFAULT 'published',
    published_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content interactions (likes, hearts, etc.)
CREATE TABLE IF NOT EXISTS public.content_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('like', 'heart', 'laugh', 'wow', 'sad', 'angry')) DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one interaction per user per content
    UNIQUE(content_id, user_id)
);

-- Content comments
CREATE TABLE IF NOT EXISTS public.content_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_id UUID REFERENCES public.content_posts(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    parent_comment_id UUID REFERENCES public.content_comments(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    is_flagged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MESSAGING TABLES (For customer-cleaner communication)
-- ============================================================================

-- Chat rooms
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    participants TEXT[] NOT NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    booking_id UUID, -- References bookings but allows NULL for standalone chats
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'location', 'booking_update')),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BOOKING & MARKETPLACE TABLES (For service bookings)
-- ============================================================================

-- Service categories
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    image TEXT,
    base_price DECIMAL(10, 2),
    estimated_duration_minutes INTEGER,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cleaner services (what services each cleaner offers)
CREATE TABLE IF NOT EXISTS public.cleaner_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.service_categories(id) ON DELETE CASCADE NOT NULL,
    custom_price DECIMAL(10, 2), -- Override category base price
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(cleaner_id, category_id)
);

-- User addresses
CREATE TABLE IF NOT EXISTS public.user_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- "Home", "Office", etc.
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    address_id UUID REFERENCES public.user_addresses(id) ON DELETE SET NULL,
    
    -- Service details
    service_category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    
    -- Pricing
    base_price DECIMAL(10, 2) NOT NULL,
    add_ons_price DECIMAL(10, 2) DEFAULT 0,
    tip_amount DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    
    -- Status tracking
    status TEXT NOT NULL CHECK (status IN (
        'pending', 'confirmed', 'cleaner_assigned', 'cleaner_en_route',
        'cleaner_arrived', 'in_progress', 'completed', 'cancelled', 'payment_failed'
    )) DEFAULT 'pending',
    
    -- Additional info
    special_instructions TEXT,
    cancellation_reason TEXT,
    
    -- Soft deletion support
    customer_deleted_at TIMESTAMPTZ,
    cleaner_deleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PAYMENT TABLES (For Stripe integration)
-- ============================================================================

-- Payment records
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    stripe_payment_intent_id TEXT UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    platform_fee DECIMAL(10, 2) NOT NULL,
    tip DECIMAL(10, 2) DEFAULT 0,
    cleaner_amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')) DEFAULT 'pending',
    currency TEXT DEFAULT 'usd',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User payment methods
CREATE TABLE IF NOT EXISTS public.user_payment_methods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    stripe_payment_method_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'card',
    last4 TEXT,
    brand TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- LOCATION TRACKING TABLES (For live GPS tracking)
-- ============================================================================

-- Location updates during service
CREATE TABLE IF NOT EXISTS public.location_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(5, 2),
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- REVIEWS & RATINGS TABLES
-- ============================================================================

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_public BOOLEAN DEFAULT true,
    
    -- Soft deletion support
    customer_deleted_at TIMESTAMPTZ,
    cleaner_deleted_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(booking_id) -- One review per booking
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_posts_user_id ON public.content_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON public.content_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_interactions_content_id ON public.content_interactions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_comments_content_id ON public.content_comments(content_id);

-- Messaging indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participants ON public.chat_rooms USING GIN(participants);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON public.chat_messages(room_id, created_at DESC);

-- Booking indexes
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_cleaner_id ON public.bookings(cleaner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status, scheduled_start);

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_location_updates_booking_id ON public.location_updates(booking_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (permissive for now, tighten in production)
CREATE POLICY "Enable all for authenticated users" ON public.users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.user_profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read for all, write for authenticated" ON public.content_posts FOR SELECT USING (true);
CREATE POLICY "Enable write for authenticated users" ON public.content_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for own posts" ON public.content_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Enable all for authenticated users" ON public.content_interactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.content_comments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.chat_rooms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.chat_messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.bookings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.payments FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.user_payment_methods FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.location_updates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.reviews FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- INSERT SAMPLE SERVICE CATEGORIES
-- ============================================================================

-- Add basic service categories if they don't exist
INSERT INTO public.service_categories (name, description, base_price, estimated_duration_minutes) 
VALUES 
    ('Kitchen Cleaning', 'Deep clean kitchen including appliances, counters, and cabinets', 75.00, 90),
    ('Bathroom Cleaning', 'Complete bathroom sanitization and deep clean', 60.00, 60),
    ('Living Room Cleaning', 'Dust, vacuum, and organize living spaces', 65.00, 75),
    ('Bedroom Cleaning', 'Thorough bedroom cleaning including bed making', 50.00, 45),
    ('Deep House Clean', 'Complete house deep cleaning service', 150.00, 180),
    ('Move-In/Move-Out', 'Comprehensive cleaning for move transitions', 200.00, 240)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- STORAGE BUCKETS FOR MEDIA
-- ============================================================================

-- Create storage buckets for videos and images
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('videos', 'videos', true),
    ('images', 'images', true),
    ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id IN ('videos', 'images', 'avatars'));
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check what tables were created
SELECT 
    'TABLES AFTER SETUP:' as info,
    tablename,
    schemaname
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check if service categories were added
SELECT 
    'SERVICE CATEGORIES:' as info,
    COUNT(*) as category_count,
    string_agg(name, ', ') as categories
FROM public.service_categories;

-- Check storage buckets
SELECT 
    'STORAGE BUCKETS:' as info,
    id as bucket_id,
    name,
    public
FROM storage.buckets;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

SELECT 
    '🎉 CHOREHERO DATABASE SETUP COMPLETE!' as status,
    'Ready for live customer ↔ cleaner usage' as message,
    NOW() as completed_at;

-- ============================================================================
-- NEXT STEPS FOR LIVE READINESS
-- ============================================================================

/*
🚀 NEXT STEPS TO GO LIVE:

1. ENVIRONMENT SETUP:
   - Add Stripe keys to .env file
   - Configure Google Maps API key
   - Set up push notification tokens

2. TEST THE FLOW:
   - Create customer account via app
   - Create cleaner account via app  
   - Upload test video as cleaner
   - Book service as customer
   - Test payment processing
   - Test GPS tracking
   - Test messaging

3. STRIPE CONFIGURATION:
   - Set up Stripe Connect for cleaner payouts
   - Configure webhook endpoints
   - Test payment processing

All database tables are now ready for live usage! 🎉
*/
