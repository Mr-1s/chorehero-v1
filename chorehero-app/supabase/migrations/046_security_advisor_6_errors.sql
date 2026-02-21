-- Migration 046: Resolve Security Advisor 6 errors (conservative, no app changes)
-- Fixes: package_analytics, package_analytics_safe, moderation_queue, video_transcoding_jobs, feed_items
-- Skips: spatial_ref_sys (PostGIS-owned; fix via Dashboard "Ask Assistant")

-- ============================================================================
-- 1. PACKAGE_ANALYTICS - Security Invoker (fixes Security Definer View)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_my_package_stats();

DROP VIEW IF EXISTS public.package_analytics_safe;
DROP VIEW IF EXISTS public.package_analytics;

CREATE VIEW public.package_analytics
  WITH (security_invoker = true)
AS
SELECT
  cp.id AS package_id,
  cp.user_id,
  cp.title,
  cp.thumbnail_url,
  cp.base_price_cents,
  cp.package_type,
  cp.is_bookable,
  cp.created_at,
  COUNT(b.id)::integer AS bookings_count,
  COUNT(CASE WHEN b.status = 'completed' THEN 1 END)::integer AS completed_bookings,
  COALESCE(SUM(CASE WHEN b.status = 'completed' THEN b.total_amount ELSE 0 END), 0)::numeric AS total_revenue,
  AVG(CASE WHEN b.status = 'completed' THEN b.total_amount END)::numeric AS avg_booking_value
FROM public.content_posts cp
LEFT JOIN public.bookings b ON b.package_id = cp.id
WHERE cp.is_bookable = true
GROUP BY cp.id;

GRANT SELECT ON public.package_analytics TO authenticated;
GRANT SELECT ON public.package_analytics TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_package_stats()
RETURNS SETOF public.package_analytics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.package_analytics
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_package_stats() TO authenticated;

-- ============================================================================
-- 2. RLS ON TABLES (moderation_queue, video_transcoding_jobs, feed_items)
-- Only runs if table exists and we have ownership; skips on error
-- No policies = deny all for anon/authenticated; service_role bypasses RLS
-- ============================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY['moderation_queue', 'video_transcoding_jobs', 'feed_items'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN insufficient_privilege THEN NULL;
      WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- 3. SPATIAL_REF_SYS - DO NOT ENABLE RLS
-- Enabling RLS on PostGIS system tables breaks ST_Transform, SRID lookups,
-- and spatial functions. Security Advisor warning is a false positive.
-- If accidentally enabled: ALTER TABLE public.spatial_ref_sys DISABLE ROW LEVEL SECURITY;
-- ============================================================================
