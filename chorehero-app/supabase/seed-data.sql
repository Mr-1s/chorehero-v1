-- Seed data for ChoreHero
-- Insert sample users (cleaners)
INSERT INTO public.users (id, phone, email, name, avatar_url, role, is_active) VALUES
(
    'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c',
    '+1234567890',
    'sarah.johnson@email.com',
    'Sarah Johnson',
    'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=150&h=150&fit=crop',
    'cleaner',
    true
),
(
    'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d',
    '+1234567891',
    'marcus.rodriguez@email.com',
    'Marcus Rodriguez',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    'cleaner',
    true
),
(
    'd2e9a8c4-af3b-6e7d-be5c-3f4a5b6c7d8e',
    '+1234567892',
    'emily.chen@email.com',
    'Emily Chen',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    'cleaner',
    true
),
(
    'e3fabc5d-ba4c-7f8e-cf6d-4a5b6c7d8e9f',
    '+1234567893',
    'michael.williams@email.com',
    'Michael Williams',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
    'cleaner',
    true
),
(
    'f4abcd6e-cb5d-8a9f-da7e-5b6c7d8e9f0a',
    '+1234567894',
    'lisa.thompson@email.com',
    'Lisa Thompson',
    'https://images.unsplash.com/photo-1494790108755-2616b612b417?w=150&h=150&fit=crop',
    'cleaner',
    true
);

-- Insert cleaner profiles
INSERT INTO public.cleaner_profiles (
    user_id, 
    video_profile_url, 
    verification_status, 
    background_check_date, 
    background_check_provider,
    rating_average, 
    rating_count, 
    total_jobs, 
    total_earnings,
    hourly_rate, 
    bio, 
    years_experience, 
    specialties,
    service_radius_km,
    is_available
) VALUES
(
    'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c',
    'https://assets.mixkit.co/videos/7862/7862-720.mp4',
    'verified',
    '2023-01-15',
    'Checkr',
    4.9,
    420,
    342,
    8550.00,
    25.00,
    'Kitchen deep clean specialist with 5+ years experience. I love transforming dirty kitchens into spotless spaces! My secret is attention to detail and eco-friendly products that are safe for your family. #cleaning #kitchen #satisfying',
    5,
    ARRAY['Kitchen Deep Clean', 'Appliance Cleaning', 'Countertop Restoration', 'Cabinet Cleaning'],
    20,
    true
),
(
    'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d',
    'https://assets.mixkit.co/videos/7862/7862-720.mp4',
    'verified',
    '2023-03-20',
    'Checkr',
    4.8,
    312,
    256,
    5632.00,
    22.00,
    'Bathroom specialist focused on removing stubborn stains and deep sanitization. I use professional-grade equipment and eco-friendly products to make your bathroom sparkle! Watch the magic happen! ✨ #cleaning #bathroom #transformation',
    3,
    ARRAY['Bathroom Deep Clean', 'Tile & Grout Cleaning', 'Eco-Friendly Products', 'Sanitization'],
    15,
    true
),
(
    'd2e9a8c4-af3b-6e7d-be5c-3f4a5b6c7d8e',
    'https://assets.mixkit.co/videos/7862/7862-720.mp4',
    'verified',
    '2023-02-10',
    'Checkr',
    4.7,
    258,
    198,
    5940.00,
    30.00,
    'Professional carpet cleaning that removes even the toughest stains safely! Safe for kids and pets - my hypoallergenic formula works wonders on all carpet types. Amazing transformations guaranteed! #carpetcleaning #petfriendly #professional',
    4,
    ARRAY['Carpet Deep Clean', 'Upholstery Cleaning', 'Pet Stain Removal', 'Odor Elimination'],
    25,
    true
),
(
    'e3fabc5d-ba4c-7f8e-cf6d-4a5b6c7d8e9f',
    'https://assets.mixkit.co/videos/7862/7862-720.mp4',
    'verified',
    '2023-04-05',
    'Checkr',
    4.6,
    189,
    145,
    3625.00,
    18.00,
    'General cleaning expert who pays attention to every detail! I specialize in regular maintenance cleaning and making your home consistently spotless. Quick, efficient, and thorough - that''s my promise! #generalcleaning #reliable #detailed',
    2,
    ARRAY['General Cleaning', 'Regular Maintenance', 'Office Cleaning', 'Move-in/Move-out'],
    18,
    true
),
(
    'f4abcd6e-cb5d-8a9f-da7e-5b6c7d8e9f0a',
    'https://assets.mixkit.co/videos/7862/7862-720.mp4',
    'verified',
    '2023-05-12',
    'Checkr',
    4.8,
    156,
    124,
    3720.00,
    35.00,
    'Move-in/Move-out cleaning specialist! I make your new home ready to live in or help you get your deposit back. Deep cleaning every corner, inside appliances, and leaving everything spotless! #movein #moveout #deepcleaning #thorough',
    6,
    ARRAY['Move-in/Move-out', 'Deep Cleaning', 'Appliance Interior', 'Post-Construction'],
    30,
    true
);

-- Insert services
INSERT INTO public.services (type, name, description, base_price, estimated_duration, included_tasks, is_active) VALUES
(
    'express',
    'Express Clean',
    'Quick 1-hour cleaning for maintenance',
    45.00,
    60,
    ARRAY['Surface dusting', 'Vacuuming', 'Bathroom wipe-down', 'Kitchen counters'],
    true
),
(
    'standard',
    'Standard Clean',
    'Comprehensive 2-3 hour cleaning',
    89.00,
    150,
    ARRAY['Deep vacuuming', 'Mopping', 'Bathroom deep clean', 'Kitchen appliances', 'Dusting all surfaces'],
    true
),
(
    'deep',
    'Deep Clean',
    'Intensive 3-5 hour deep cleaning',
    150.00,
    240,
    ARRAY['Inside appliances', 'Baseboards', 'Light fixtures', 'Cabinet interiors', 'Detailed scrubbing'],
    true
);

-- Insert some sample add-ons
INSERT INTO public.add_ons (name, description, price, estimated_time_minutes, category, is_active) VALUES
('Inside Oven Cleaning', 'Deep clean inside your oven', 25.00, 30, 'Kitchen', true),
('Inside Fridge Cleaning', 'Clean and sanitize refrigerator interior', 20.00, 20, 'Kitchen', true),
('Window Cleaning (Interior)', 'Clean all interior windows', 30.00, 45, 'General', true),
('Garage Cleaning', 'Sweep and organize garage space', 40.00, 60, 'General', true),
('Basement Cleaning', 'Clean and organize basement area', 35.00, 45, 'General', true);

-- Insert sample ratings/reviews
INSERT INTO public.ratings (rated_id, rating, comment, created_at) VALUES
('b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', 5, 'Sarah did an amazing job on my kitchen! It looks brand new.', '2024-01-10 10:00:00+00'),
('b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', 5, 'Incredible attention to detail. My kitchen has never been cleaner!', '2024-01-08 14:30:00+00'),
('c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', 5, 'Marcus removed stains I thought were permanent. Highly recommend!', '2024-01-09 16:45:00+00'),
('c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', 4, 'Great bathroom cleaning service. Very professional and thorough.', '2024-01-07 11:20:00+00'),
('d2e9a8c4-af3b-6e7d-be5c-3f4a5b6c7d8e', 5, 'Emily got pet stains out that other cleaners couldn''t remove!', '2024-01-11 09:15:00+00'),
('d2e9a8c4-af3b-6e7d-be5c-3f4a5b6c7d8e', 5, 'Professional carpet cleaning at its finest. Carpets look new!', '2024-01-06 13:00:00+00');

-- Insert sample addresses (for testing)
INSERT INTO public.addresses (user_id, street, city, state, zip_code, latitude, longitude, is_default, nickname, access_instructions) VALUES
('b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', '123 Main St', 'Atlanta', 'GA', '30309', 33.7490, -84.3880, true, 'Home', 'Ring doorbell, spare key under mat'),
('c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', '456 Oak Ave', 'Atlanta', 'GA', '30309', 33.7510, -84.3870, true, 'Home', 'Front door, call when arrived'),
('d2e9a8c4-af3b-6e7d-be5c-3f4a5b6c7d8e', '789 Pine Rd', 'Atlanta', 'GA', '30309', 33.7520, -84.3860, true, 'Home', 'Side entrance, garage door code 1234'),
('e3fabc5d-ba4c-7f8e-cf6d-4a5b6c7d8e9f', '321 Elm Dr', 'Atlanta', 'GA', '30309', 33.7530, -84.3850, true, 'Home', 'Apartment 2B, buzz to enter'),
('f4abcd6e-cb5d-8a9f-da7e-5b6c7d8e9f0a', '654 Maple Ln', 'Atlanta', 'GA', '30309', 33.7540, -84.3840, true, 'Home', 'Back door, key in lockbox (code 5678)');

-- Update location geography for spatial queries
UPDATE public.addresses SET location = ST_Point(longitude, latitude) WHERE location IS NULL;

-- ============================================================================
-- DEMO ECOSYSTEM DATA - Full End-to-End Demo Experience
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
);

-- Insert demo customer profile
INSERT INTO public.customer_profiles (user_id, preferred_language, special_preferences) VALUES
(
    'demo-customer-001',
    'en',
    'Demo customer account for testing booking flows and service interactions'
);

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
);

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
);

-- Insert demo interactions (likes from demo customer)
INSERT INTO public.content_interactions (user_id, post_id, interaction_type, created_at) VALUES
('demo-customer-001', 'demo-post-sarah-001', 'like', NOW() - INTERVAL '1 day'),
('demo-customer-001', 'demo-post-marcus-001', 'like', NOW() - INTERVAL '2 hours'),
('demo-customer-001', 'demo-post-emily-001', 'like', NOW() - INTERVAL '6 hours');

-- Insert demo comments from demo customer
INSERT INTO public.content_comments (post_id, user_id, content, created_at) VALUES
('demo-post-sarah-001', 'demo-customer-001', 'This is exactly what my kitchen needs! How can I book this service?', NOW() - INTERVAL '1 day'),
('demo-post-marcus-001', 'demo-customer-001', 'Amazing work! My bathroom grout looks terrible, would love to book you.', NOW() - INTERVAL '2 hours'),
('demo-post-emily-001', 'demo-customer-001', 'Perfect timing! I have pet stains that need professional help.', NOW() - INTERVAL '6 hours');

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
);

-- Insert demo chat threads for the bookings
INSERT INTO public.chat_threads (id, booking_id, customer_id, cleaner_id, created_at, updated_at) VALUES
('demo-chat-001', 'demo-booking-001', 'demo-customer-001', 'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '5 minutes'),
('demo-chat-002', 'demo-booking-002', 'demo-customer-001', 'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '2 minutes');

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
('demo-chat-002', 'c1d8f7b3-9e2a-5f6c-ad4b-2e3f4a5b6c7d', 'Perfect! Those are exactly the type of stains I love tackling. I''ll bring my professional grout cleaning equipment. You''ll be amazed at the results!', 'text', NOW() - INTERVAL '2 minutes');

-- Update geography for demo customer address
UPDATE public.addresses SET location = ST_Point(longitude, latitude) WHERE user_id = 'demo-customer-001'; 