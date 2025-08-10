-- ChoreHero Database - Clean Up Private Queries
-- This will remove unnecessary functions, triggers, and duplicates
-- Run in Supabase SQL Editor to reduce the 22 private queries

-- CAUTION: Backup your database first!

-- ============================================================================
-- REMOVE UNUSED COMPLEX FUNCTIONS
-- ============================================================================

-- Remove unused booking calculation functions (logic moved to service layer)
DROP FUNCTION IF EXISTS public.calculate_booking_total(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.find_available_cleaners(DECIMAL, DECIMAL, INTEGER, TIMESTAMPTZ) CASCADE;
DROP FUNCTION IF EXISTS public.complete_booking(UUID) CASCADE;

-- Remove unused rating functions (handled in service layer)
DROP FUNCTION IF EXISTS public.update_user_rating(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_update_rating() CASCADE;

-- Remove unused distance calculation (using external APIs)
DROP FUNCTION IF EXISTS public.calculate_distance_km(DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;

-- ============================================================================
-- REMOVE DUPLICATE TRIGGER FUNCTIONS
-- ============================================================================

-- Drop all triggers first to avoid dependency issues
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users CASCADE;
DROP TRIGGER IF EXISTS update_customer_profiles_updated_at ON public.customer_profiles CASCADE;
DROP TRIGGER IF EXISTS update_cleaner_profiles_updated_at ON public.cleaner_profiles CASCADE;
DROP TRIGGER IF EXISTS update_addresses_updated_at ON public.addresses CASCADE;
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings CASCADE;
DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON public.chat_threads CASCADE;
DROP TRIGGER IF EXISTS update_content_posts_updated_at ON public.content_posts CASCADE;
DROP TRIGGER IF EXISTS update_content_comments_updated_at ON public.content_comments CASCADE;

-- Drop duplicate update functions (keep only one)
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- ============================================================================
-- REMOVE UNUSED CONTENT COUNT FUNCTIONS
-- ============================================================================

-- These are handled in the service layer for better performance
DROP FUNCTION IF EXISTS public.update_content_interaction_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_content_interaction_counts() CASCADE;
DROP FUNCTION IF EXISTS public.update_content_comment_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_comment_like_count() CASCADE;
DROP FUNCTION IF EXISTS public.update_content_counts() CASCADE;
DROP FUNCTION IF EXISTS public.update_comment_counts() CASCADE;

-- Remove chat room message update triggers
DROP FUNCTION IF EXISTS public.update_chat_room_last_message() CASCADE;

-- ============================================================================
-- RECREATE ONLY ESSENTIAL FUNCTIONS
-- ============================================================================

-- Single updated_at function for timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create triggers for essential tables that need updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at 
    BEFORE UPDATE ON public.bookings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SIMPLIFY RLS HELPER FUNCTIONS (keep only essential ones)
-- ============================================================================

-- Keep only the most used RLS helper
-- Remove the others as they can be replaced with direct queries in policies

DROP FUNCTION IF EXISTS auth.is_customer() CASCADE;
DROP FUNCTION IF EXISTS auth.is_verified_cleaner() CASCADE;

-- Keep only these two essential ones:
-- auth.is_cleaner() - used frequently in RLS
-- auth.booking_belongs_to_user() - used frequently in RLS

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check remaining functions (should be much fewer now)
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND p.proname NOT LIKE 'pg_%'
ORDER BY n.nspname, p.proname;

-- You should now see significantly fewer private queries in your Supabase dashboard
SELECT 'Private queries cleanup completed! Check your Supabase dashboard for reduced query count.' as result;