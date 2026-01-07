-- Quick fix: Create cleaner profile for demo user Sarah Johnson
-- Run this in Supabase SQL Editor if you want to test immediately

-- Insert or update the cleaner profile for Sarah Johnson
INSERT INTO public.cleaner_profiles (
    user_id,
    bio,
    hourly_rate,
    experience_years,
    rating,
    total_reviews,
    verification_status,
    specialties,
    is_available,
    created_at,
    updated_at
) VALUES (
    'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c', -- Sarah Johnson's ID
    'Professional house cleaner with 5+ years of experience. Specializing in deep cleaning and eco-friendly products.',
    35.00,
    5,
    4.9,
    127,
    'verified',
    ARRAY['Deep Cleaning', 'Eco-Friendly', 'Kitchen Specialist', 'Move-in/Move-out'],
    true,
    NOW(),
    NOW()
) ON CONFLICT (user_id) DO UPDATE SET
    bio = EXCLUDED.bio,
    hourly_rate = EXCLUDED.hourly_rate,
    experience_years = EXCLUDED.experience_years,
    rating = EXCLUDED.rating,
    total_reviews = EXCLUDED.total_reviews,
    verification_status = EXCLUDED.verification_status,
    specialties = EXCLUDED.specialties,
    is_available = EXCLUDED.is_available,
    updated_at = NOW();

-- Also ensure the user record exists
INSERT INTO public.users (id, phone, email, name, avatar_url, role, is_active) VALUES
(
    'b0c7e6a2-8f1d-4e5b-9c3a-1d2e3f4a5b6c',
    '+1234567890',
    'sarah.johnson@email.com',
    'Sarah Johnson',
    'https://images.unsplash.com/photo-1494790108755-2616b612b5bc?w=150&h=150&fit=crop',
    'cleaner',
    true
) ON CONFLICT (id) DO UPDATE SET
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    role = EXCLUDED.role,
    updated_at = NOW();

SELECT 'Demo cleaner profile created successfully!' as status;