-- Create Storage Buckets for ChoreHero Content Uploads
-- Run this in Supabase SQL Editor to create the required buckets

-- ============================================================================
-- CREATE STORAGE BUCKETS
-- ============================================================================

-- Create content-videos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-videos', 
  'content-videos', 
  true, 
  104857600, -- 100MB limit
  array['video/mp4', 'video/mov', 'video/quicktime', 'video/avi']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 104857600,
  allowed_mime_types = array['video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];

-- Create content-images bucket  
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-images',
  'content-images', 
  true,
  10485760, -- 10MB limit
  array['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

-- Create videos bucket (for cleaner profiles)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos', 
  true,
  104857600, -- 100MB limit  
  array['video/mp4', 'video/mov', 'video/quicktime', 'video/avi']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 104857600,
  allowed_mime_types = array['video/mp4', 'video/mov', 'video/quicktime', 'video/avi'];

-- ============================================================================
-- STORAGE POLICIES (RLS for Storage Objects)
-- ============================================================================

-- Allow authenticated users to upload to content-videos
CREATE POLICY "Authenticated users can upload videos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'content-videos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to upload to content-images
CREATE POLICY "Authenticated users can upload images" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'content-images' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to upload to videos (cleaner profiles)
CREATE POLICY "Authenticated users can upload profile videos" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'videos' 
  AND auth.role() = 'authenticated'
);

-- Allow public viewing of all content
CREATE POLICY "Public can view content files" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('content-videos', 'content-images', 'videos'));

-- Allow users to update their own uploads (using folder structure)
CREATE POLICY "Users can update their own uploads" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id IN ('content-videos', 'content-images', 'videos')
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own uploads" 
ON storage.objects FOR DELETE 
USING (
  bucket_id IN ('content-videos', 'content-images', 'videos')
  AND auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that buckets were created
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id IN ('content-videos', 'content-images', 'videos');

-- Check storage policies
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
ORDER BY policyname;

SELECT 'Storage buckets and policies created successfully!' as status;