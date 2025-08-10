-- Reduce Supabase Egress Usage
-- Run these queries to optimize storage and reduce bandwidth usage

-- ============================================================================
-- 1. ANALYZE CURRENT USAGE
-- ============================================================================

-- Check total storage usage by bucket
SELECT 
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size'::text::bigint) as total_bytes,
  ROUND(SUM(metadata->>'size'::text::bigint) / 1024.0 / 1024.0, 2) as total_mb
FROM storage.objects 
WHERE bucket_id IN ('content-videos', 'content-images', 'videos')
GROUP BY bucket_id
ORDER BY total_bytes DESC;

-- Find largest files
SELECT 
  bucket_id,
  name,
  metadata->>'size' as file_size_bytes,
  ROUND((metadata->>'size'::text::bigint) / 1024.0 / 1024.0, 2) as file_size_mb,
  created_at
FROM storage.objects 
WHERE bucket_id IN ('content-videos', 'content-images', 'videos')
ORDER BY (metadata->>'size'::text::bigint) DESC 
LIMIT 20;

-- ============================================================================
-- 2. CLEAN UP UNUSED FILES
-- ============================================================================

-- Find storage files with no corresponding content_posts
WITH orphaned_files AS (
  SELECT so.bucket_id, so.name, so.metadata->>'size' as size_bytes
  FROM storage.objects so
  WHERE so.bucket_id IN ('content-videos', 'content-images')
  AND NOT EXISTS (
    SELECT 1 FROM public.content_posts cp 
    WHERE so.name LIKE '%' || SPLIT_PART(cp.media_url, '/', -1) || '%'
  )
)
SELECT 
  'DELETE FROM storage.objects WHERE bucket_id = ''' || bucket_id || ''' AND name = ''' || name || ''';' as cleanup_sql
FROM orphaned_files
LIMIT 10; -- Review before running these DELETE statements

-- ============================================================================
-- 3. FIND DUPLICATE UPLOADS
-- ============================================================================

-- Find potential duplicate files by size
SELECT 
  metadata->>'size' as file_size,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(name) as file_names
FROM storage.objects 
WHERE bucket_id IN ('content-videos', 'content-images')
GROUP BY metadata->>'size'
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- 4. EGRESS OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

SELECT 'Egress Reduction Recommendations:' as recommendations
UNION ALL SELECT '1. Enable image compression in your app'
UNION ALL SELECT '2. Use thumbnail URLs instead of full images for lists'  
UNION ALL SELECT '3. Implement lazy loading for media'
UNION ALL SELECT '4. Consider upgrading to Supabase Pro for 100GB egress'
UNION ALL SELECT '5. Use CDN caching for frequently accessed files';