-- Diagnose Current Database State
-- Run these queries in Supabase SQL Editor to see what we have now

-- ============================================================================
-- 1. CHECK WHAT TABLES CURRENTLY EXIST
-- ============================================================================

SELECT 
    schemaname, 
    tablename,
    tableowner,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- ============================================================================
-- 2. CHECK USER DATA (see if real users exist)
-- ============================================================================

-- Count of users by role
SELECT 
    role,
    COUNT(*) as user_count,
    MAX(created_at) as last_created
FROM public.users 
GROUP BY role;

-- Sample of recent users (don't show sensitive data)
SELECT 
    id,
    role,
    name,
    profile_completed,
    created_at
FROM public.users 
ORDER BY created_at DESC 
LIMIT 5;

-- ============================================================================
-- 3. CHECK CLEANER PROFILES
-- ============================================================================

SELECT 
    COUNT(*) as cleaner_count,
    COUNT(CASE WHEN video_profile_url IS NOT NULL THEN 1 END) as with_videos,
    AVG(hourly_rate) as avg_rate
FROM public.cleaner_profiles;

-- ============================================================================
-- 4. CHECK CONTENT POSTS (your uploaded videos)
-- ============================================================================

SELECT 
    COUNT(*) as total_posts,
    COUNT(CASE WHEN content_type = 'video' THEN 1 END) as video_posts,
    COUNT(CASE WHEN status = 'published' THEN 1 END) as published_posts,
    MAX(created_at) as last_post
FROM public.content_posts;

-- Sample of recent posts
SELECT 
    id,
    user_id,
    title,
    content_type,
    status,
    created_at
FROM public.content_posts 
ORDER BY created_at DESC 
LIMIT 3;

-- ============================================================================
-- 5. CHECK RLS POLICIES (might be blocking data)
-- ============================================================================

SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    LEFT(qual, 100) as policy_condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'cleaner_profiles', 'customer_profiles', 'content_posts')
ORDER BY tablename, policyname;

-- ============================================================================
-- 6. CHECK FOR FUNCTIONS THAT MIGHT BE INTERFERING
-- ============================================================================

SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND p.proname NOT LIKE 'pg_%'
AND p.proname NOT LIKE 'gen_%'
ORDER BY n.nspname, p.proname;

-- ============================================================================
-- 7. CHECK STORAGE BUCKETS
-- ============================================================================

SELECT 
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types,
    created_at
FROM storage.buckets 
ORDER BY created_at;

SELECT 'Database diagnosis complete. Review results to identify issues.' as status;