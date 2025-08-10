-- ChoreHero Database Cleanup - Remove Unnecessary Tables
-- Run these commands in Supabase SQL Editor to remove tables not needed for MVP

-- CAUTION: This will permanently delete tables and data!
-- Make sure to backup your database before running these commands

-- ============================================================================
-- SOCIAL FEATURES CLEANUP (beyond MVP scope)
-- ============================================================================

-- Remove advanced social features that aren't core to cleaning marketplace
DROP TABLE IF EXISTS public.comment_likes CASCADE;
DROP TABLE IF EXISTS public.content_views CASCADE; 
DROP TABLE IF EXISTS public.user_follows CASCADE;

-- Remove complex payment tracking (use Stripe's dashboard instead)  
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.payouts CASCADE;

-- ============================================================================
-- REDUNDANT TABLES CLEANUP  
-- ============================================================================

-- Remove tables that duplicate functionality
DROP TABLE IF EXISTS public.booking_status_history CASCADE; -- Status is tracked in bookings table
DROP TABLE IF EXISTS public.cleaner_services CASCADE; -- Functionality covered by service_categories

-- Remove unused notification variants
DROP TABLE IF EXISTS public.content_notifications CASCADE; -- Use main notifications table

-- ============================================================================
-- OVER-ENGINEERED FEATURES (not needed for MVP)
-- ============================================================================

-- Remove complex review breakdown (simple rating in reviews table is enough)
-- Keep the main reviews table but remove the complex rating breakdowns

-- Remove advanced service categorization
DROP TABLE IF EXISTS public.service_categories CASCADE; -- Use simple services table instead

-- ============================================================================
-- VERIFICATION - Check remaining essential tables
-- ============================================================================

-- Run this to see what tables remain (should be ~12-15 core tables)
SELECT 
    schemaname, 
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Essential tables that should remain:
-- users, customer_profiles, cleaner_profiles
-- bookings, booking_add_ons
-- addresses, payment_methods
-- services, add_ons
-- cleaner_availability
-- location_updates
-- chat_threads, chat_messages
-- ratings, notifications
-- content_posts, content_interactions, content_comments (core social features only)