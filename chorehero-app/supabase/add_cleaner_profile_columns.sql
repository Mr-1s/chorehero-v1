-- Add missing columns to cleaner_profiles table
-- Run this in your Supabase SQL Editor

-- Add available_services array
ALTER TABLE public.cleaner_profiles 
ADD COLUMN IF NOT EXISTS available_services TEXT[];

-- Add coverage_area
ALTER TABLE public.cleaner_profiles 
ADD COLUMN IF NOT EXISTS coverage_area TEXT;

-- Add instant_booking
ALTER TABLE public.cleaner_profiles 
ADD COLUMN IF NOT EXISTS instant_booking BOOLEAN DEFAULT false;

-- Add background_checked (using the existing background_check_date to determine status)
ALTER TABLE public.cleaner_profiles 
ADD COLUMN IF NOT EXISTS background_checked BOOLEAN DEFAULT false;

-- Add verified status
ALTER TABLE public.cleaner_profiles 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Grant RLS policies for cleaners to update their own profiles
CREATE POLICY IF NOT EXISTS "Cleaners can update own profile" ON public.cleaner_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Cleaners can read own profile" ON public.cleaner_profiles
    FOR SELECT USING (auth.uid() = user_id OR true);  -- Public read for customer browsing
