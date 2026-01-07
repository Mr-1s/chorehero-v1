-- Fix Content Upload RLS Issues
-- This addresses the "new row violates row-level security policy" errors

-- ============================================================================
-- 1. STORAGE BUCKET POLICIES (for Supabase Storage)
-- ============================================================================

-- Create storage buckets with proper policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('content-videos', 'content-videos', true, 104857600, array['video/mp4', 'video/mov', 'video/quicktime']),
  ('content-images', 'content-images', true, 10485760, array['image/jpeg', 'image/png', 'image/jpg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for content uploads
CREATE POLICY "Authenticated users can upload content videos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'content-videos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can upload content images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'content-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Public can view content files" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('content-videos', 'content-images'));

CREATE POLICY "Users can update their own uploads" 
ON storage.objects FOR UPDATE 
USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own uploads" 
ON storage.objects FOR DELETE 
USING (auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- 2. CONTENT POSTS TABLE POLICIES (fix conflicting policies)
-- ============================================================================

-- First, drop all existing conflicting policies
DROP POLICY IF EXISTS "Content posts are viewable by everyone" ON public.content_posts;
DROP POLICY IF EXISTS "Users can insert their own content posts" ON public.content_posts;
DROP POLICY IF EXISTS "Users can update their own content posts" ON public.content_posts;
DROP POLICY IF EXISTS "Users can delete their own content posts" ON public.content_posts;
DROP POLICY IF EXISTS "Published content is public" ON public.content_posts;
DROP POLICY IF EXISTS "Users can manage own content" ON public.content_posts;
DROP POLICY IF EXISTS "Public can view published content" ON public.content_posts;
DROP POLICY IF EXISTS "Users can manage their own content" ON public.content_posts;

-- Enable RLS on content_posts table
ALTER TABLE public.content_posts ENABLE ROW LEVEL SECURITY;

-- Create clear, non-conflicting policies
CREATE POLICY "Anyone can view published content" 
ON public.content_posts FOR SELECT 
USING (status = 'published');

CREATE POLICY "Authenticated users can create content" 
ON public.content_posts FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own content" 
ON public.content_posts FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own content" 
ON public.content_posts FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================================================
-- 3. CONTENT INTERACTIONS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all interactions" ON public.content_interactions;
DROP POLICY IF EXISTS "Users can insert their own interactions" ON public.content_interactions;
DROP POLICY IF EXISTS "Users can update their own interactions" ON public.content_interactions;
DROP POLICY IF EXISTS "Users can delete their own interactions" ON public.content_interactions;
DROP POLICY IF EXISTS "Users can manage their own interactions" ON public.content_interactions;
DROP POLICY IF EXISTS "Anyone can view interactions" ON public.content_interactions;

-- Enable RLS
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;

-- Create clear policies
CREATE POLICY "Anyone can view interactions" 
ON public.content_interactions FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create interactions" 
ON public.content_interactions FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own interactions" 
ON public.content_interactions FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own interactions" 
ON public.content_interactions FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================================================
-- 4. CONTENT COMMENTS TABLE POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.content_comments;
DROP POLICY IF EXISTS "Users can insert their own comments" ON public.content_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.content_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.content_comments;
DROP POLICY IF EXISTS "Anyone can view comments on published content" ON public.content_comments;
DROP POLICY IF EXISTS "Users can manage their own comments" ON public.content_comments;

-- Enable RLS
ALTER TABLE public.content_comments ENABLE ROW LEVEL SECURITY;

-- Create clear policies
CREATE POLICY "Anyone can view comments" 
ON public.content_comments FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create comments" 
ON public.content_comments FOR INSERT 
WITH CHECK (auth.uid() = user_id AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments" 
ON public.content_comments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.content_comments FOR DELETE 
USING (auth.uid() = user_id);

-- ============================================================================
-- 5. ENSURE USERS TABLE HAS PROPER POLICIES
-- ============================================================================

-- Make sure users can be viewed by content queries
DROP POLICY IF EXISTS "Users can view public cleaner profiles" ON public.users;
CREATE POLICY "Anyone can view public user profiles" 
ON public.users FOR SELECT 
USING (role IN ('cleaner', 'customer'));

-- ============================================================================
-- 6. VERIFICATION QUERIES
-- ============================================================================

-- Check that policies are correctly applied
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename LIKE '%content%'
ORDER BY tablename, policyname;

-- Check storage policies
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

SELECT 'Content upload RLS policies fixed! You should now be able to upload content.' as result;