-- ============================================================================
-- DEMO ECOSYSTEM DATA - Full End-to-End Demo Experience
-- Migration: 005_demo_ecosystem.sql
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
) ON CONFLICT (id) DO NOTHING;

-- Insert demo customer profile
INSERT INTO public.customer_profiles (user_id, preferred_language, special_preferences) VALUES
(
    'demo-customer-001',
    'en',
    'Demo customer account for testing booking flows and service interactions'
) ON CONFLICT (user_id) DO NOTHING;

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
) ON CONFLICT (user_id, nickname) DO NOTHING;

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
) ON CONFLICT (id) DO NOTHING;

-- Insert demo interactions (likes from demo customer)
INSERT INTO public.content_interactions (user_id, post_id, interaction_type, created_at) VALUES
('demo-customer-001', 'demo-post-sarah-001', 'like', NOW() - INTERVAL '1 day'),
('demo-customer-001', 'demo-post-marcus-001', 'like', NOW() - INTERVAL '2 hours'),
('demo-customer-001', 'demo-post-emily-001', 'like', NOW() - INTERVAL '6 hours')
ON CONFLICT (user_id, post_id, interaction_type) DO NOTHING;

-- Insert demo comments from demo customer
INSERT INTO public.content_comments (post_id, user_id, content, created_at) VALUES
('demo-post-sarah-001', 'demo-customer-001', 'This is exactly what my kitchen needs! How can I book this service?', NOW() - INTERVAL '1 day'),
('demo-post-marcus-001', 'demo-customer-001', 'Amazing work! My bathroom grout looks terrible, would love to book you.', NOW() - INTERVAL '2 hours'),
('demo-post-emily-001', 'demo-customer-001', 'Perfect timing! I have pet stains that need professional help.', NOW() - INTERVAL '6 hours')
ON CONFLICT DO NOTHING;

-- Insert demo bookings (customer booking demo cleaner services)
INSERT INTO public.bookings (
    id,
    customer_id,
    cleaner_id,
    service_id,
    address_id,
    scheduled_date,
    scheduled_time,
    estimated_duration_minutes,
    total_price,
    status,
    special_instructions,
    created_at,
    updated_at
) VALUES
-- Demo customer books Sarah for kitchen cleaning
(
    'demo-booking-001',
    'demo-customer-001',
    'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c',
    1, -- Kitchen cleaning service
    (SELECT id FROM public.addresses WHERE user_id = 'demo-customer-001' LIMIT 1),
    CURRENT_DATE + INTERVAL '2 days',
    '10:00:00',
    120,
    85.00,
    'pending',
    'Booked after seeing your amazing kitchen transformation video! Please focus on the refrigerator and stovetop.',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '30 minutes'
),
-- Demo customer books Marcus for bathroom cleaning  
(
    'demo-booking-002',
    'demo-customer-001',
    'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d',
    2, -- Bathroom cleaning service
    (SELECT id FROM public.addresses WHERE user_id = 'demo-customer-001' LIMIT 1),
    CURRENT_DATE + INTERVAL '3 days',
    '14:00:00',
    90,
    65.00,
    'pending',
    'Your grout restoration video convinced me! My bathroom grout really needs professional attention.',
    NOW() - INTERVAL '15 minutes',
    NOW() - INTERVAL '15 minutes'
) ON CONFLICT (id) DO NOTHING;

-- Insert demo chat threads for the bookings
INSERT INTO public.chat_threads (id, booking_id, customer_id, cleaner_id, created_at, updated_at) VALUES
('demo-chat-001', 'demo-booking-001', 'demo-customer-001', 'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '5 minutes'),
('demo-chat-002', 'demo-booking-002', 'demo-customer-001', 'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '2 minutes')
ON CONFLICT (id) DO NOTHING;

-- Insert demo chat messages
INSERT INTO public.chat_messages (thread_id, sender_id, content, message_type, created_at) VALUES
-- Chat for kitchen cleaning booking
('demo-chat-001', 'demo-customer-001', 'Hi Sarah! I just booked your kitchen cleaning service after watching your transformation video. It was incredible!', 'text', NOW() - INTERVAL '25 minutes'),
('demo-chat-001', 'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', 'Thank you so much! I''m excited to help transform your kitchen. I saw your note about focusing on the refrigerator and stovetop - I''ll make sure to give those extra attention.', 'text', NOW() - INTERVAL '20 minutes'),
('demo-chat-001', 'demo-customer-001', 'That sounds perfect! Should I clear out the refrigerator beforehand?', 'text', NOW() - INTERVAL '15 minutes'),
('demo-chat-001', 'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', 'Yes, please remove all food items. I''ll bring all the professional cleaning supplies. See you Tuesday at 10am!', 'text', NOW() - INTERVAL '5 minutes'),

-- Chat for bathroom cleaning booking  
('demo-chat-002', 'demo-customer-001', 'Hi Marcus! Your grout restoration video was amazing. I booked your bathroom service - my grout really needs professional help.', 'text', NOW() - INTERVAL '10 minutes'),
('demo-chat-002', 'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', 'Thank you for booking! I specialize in grout restoration and I''m confident I can make your bathroom look brand new. Any specific problem areas?', 'text', NOW() - INTERVAL '5 minutes'),
('demo-chat-002', 'demo-customer-001', 'The shower area has some dark stains that I can''t seem to remove no matter what I try.', 'text', NOW() - INTERVAL '3 minutes'),
('demo-chat-002', 'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', 'Perfect! Those are exactly the type of stains I love tackling. I''ll bring my professional grout cleaning equipment. You''ll be amazed at the results!', 'text', NOW() - INTERVAL '2 minutes')
ON CONFLICT DO NOTHING;

-- Update geography for demo customer address
UPDATE public.addresses SET location = ST_Point(longitude, latitude) WHERE user_id = 'demo-customer-001' AND location IS NULL;