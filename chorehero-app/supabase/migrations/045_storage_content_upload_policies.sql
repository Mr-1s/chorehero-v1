-- Migration 045: Storage buckets and RLS policies for content uploads
-- Fixes "new row violates row-level security policy" when uploading videos/images

-- ============================================================================
-- 1. CREATE BUCKETS (if not exist)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-videos',
  'content-videos',
  true,
  104857600, -- 100MB
  array['video/mp4', 'video/mov', 'video/quicktime', 'video/avi']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 104857600,
  allowed_mime_types = array['video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-images',
  'content-images',
  true,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

-- ============================================================================
-- 2. DROP EXISTING POLICIES (avoid conflicts)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload content videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload content images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view content files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- ============================================================================
-- 3. CREATE POLICIES - INSERT (authenticated only)
-- ============================================================================
CREATE POLICY "Authenticated users can upload to content-videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-videos');

CREATE POLICY "Authenticated users can upload to content-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'content-images');

-- ============================================================================
-- 4. CREATE POLICIES - SELECT (public read for content buckets)
-- ============================================================================
CREATE POLICY "Public can view content-videos and content-images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('content-videos', 'content-images'));

-- ============================================================================
-- 5. CREATE POLICIES - UPDATE/DELETE (for upsert and user cleanup)
-- ============================================================================
CREATE POLICY "Authenticated users can update content uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('content-videos', 'content-images'))
WITH CHECK (bucket_id IN ('content-videos', 'content-images'));

CREATE POLICY "Authenticated users can delete content uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('content-videos', 'content-images'));
