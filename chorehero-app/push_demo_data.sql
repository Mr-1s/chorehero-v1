-- ============================================================================
-- DEMO ECOSYSTEM DATA - Manual Push Script
-- Run this directly in Supabase SQL Editor
-- ============================================================================

-- Insert demo customer account
INSERT INTO public.users (id, phone, email, name, avatar_url, role, is_active) VALUES
(
    'demo-customer-001',
    '+1555123456',
    'demo.customer@chorehero.com',
    'Demo Customer',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    'customer',
    true
) ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    updated_at = NOW();

-- Insert demo customer profile
INSERT INTO public.customer_profiles (user_id, preferred_language, special_preferences) VALUES
(
    'demo-customer-001',
    'en',
    'Demo customer account for testing booking flows and service interactions'
) ON CONFLICT (user_id) DO UPDATE SET
    preferred_language = EXCLUDED.preferred_language,
    special_preferences = EXCLUDED.special_preferences;

-- Insert demo customer address
INSERT INTO public.addresses (user_id, street, city, state, zip_code, latitude, longitude, is_default, nickname, access_instructions) VALUES
(
    'demo-customer-001',
    '100 Demo Street',
    'Atlanta',
    'GA',
    '30309',
    33.7490,
    -84.3880,
    true,
    'Demo Home',
    'Demo access instructions - ring doorbell'
) ON CONFLICT (user_id, nickname) DO UPDATE SET
    street = EXCLUDED.street,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip_code = EXCLUDED.zip_code,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    access_instructions = EXCLUDED.access_instructions;

-- Insert demo content posts from demo cleaners
INSERT INTO public.content_posts (
    id,
    user_id,
    title,
    description,
    content_type,
    media_url,
    thumbnail_url,
    location_name,
    duration_seconds,
    view_count,
    like_count,
    comment_count,
    share_count,
    is_featured,
    created_at,
    updated_at
) VALUES
-- Sarah Johnson's Demo Content
(
    'demo-post-sarah-001',
    'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c',
    'Kitchen Deep Clean Transformation',
    'Watch me transform this kitchen from messy to spotless! Professional deep cleaning techniques that will make your kitchen shine ✨',
    'video',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop',
    'Atlanta, GA',
    180,
    1247,
    89,
    12,
    5,
    true,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
),
(
    'demo-post-sarah-002',
    'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c',
    'Refrigerator Deep Clean',
    'Step-by-step guide to getting your fridge sparkling clean and organized 🧽',
    'video',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop',
    'Atlanta, GA',
    120,
    892,
    67,
    8,
    3,
    false,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
),
-- Marcus Rodriguez's Demo Content
(
    'demo-post-marcus-001',
    'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d',
    'Bathroom Tile Grout Restoration',
    'Professional grout cleaning and restoration techniques. See how I make old grout look brand new! 🚿',
    'video',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400&h=300&fit=crop',
    'Atlanta, GA',
    210,
    1567,
    134,
    19,
    7,
    true,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
),
-- Emily Chen's Demo Content  
(
    'demo-post-emily-001',
    'd2e9a8c4-af3b-6e7d-be5c-3f4a5b6c7d8e',
    'Pet Stain Removal Magic',
    'Professional carpet cleaning specialist showing you how to completely remove tough pet stains and odors 🐕',
    'video',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
    'Atlanta, GA',
    165,
    2103,
    178,
    24,
    11,
    true,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
) ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content_type = EXCLUDED.content_type,
    media_url = EXCLUDED.media_url,
    thumbnail_url = EXCLUDED.thumbnail_url,
    location_name = EXCLUDED.location_name,
    duration_seconds = EXCLUDED.duration_seconds,
    view_count = EXCLUDED.view_count,
    like_count = EXCLUDED.like_count,
    comment_count = EXCLUDED.comment_count,
    share_count = EXCLUDED.share_count,
    is_featured = EXCLUDED.is_featured,
    updated_at = NOW();

-- Insert demo interactions (likes from demo customer)
INSERT INTO public.content_interactions (user_id, post_id, interaction_type, created_at) VALUES
('demo-customer-001', 'demo-post-sarah-001', 'like', NOW() - INTERVAL '1 day'),
('demo-customer-001', 'demo-post-marcus-001', 'like', NOW() - INTERVAL '2 hours'),
('demo-customer-001', 'demo-post-emily-001', 'like', NOW() - INTERVAL '6 hours')
ON CONFLICT (user_id, post_id, interaction_type) DO NOTHING;

-- Insert demo comments from demo customer
INSERT INTO public.content_comments (id, post_id, user_id, content, created_at) VALUES
('demo-comment-001', 'demo-post-sarah-001', 'demo-customer-001', 'This is exactly what my kitchen needs! How can I book this service?', NOW() - INTERVAL '1 day'),
('demo-comment-002', 'demo-post-marcus-001', 'demo-customer-001', 'Amazing work! My bathroom grout looks terrible, would love to book you.', NOW() - INTERVAL '2 hours'),
('demo-comment-003', 'demo-post-emily-001', 'demo-customer-001', 'Perfect timing! I have pet stains that need professional help.', NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = NOW();

-- Update geography for demo customer address
UPDATE public.addresses 
SET location = ST_Point(longitude, latitude) 
WHERE user_id = 'demo-customer-001' AND location IS NULL;

-- Print completion message
SELECT 'Demo ecosystem data successfully pushed to database!' as status;