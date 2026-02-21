-- Migration 044: Fix Security Advisor errors
-- 1. package_analytics: Security Definer View -> Security Invoker
-- 2. spatial_ref_sys: SKIPPED - PostGIS owns the table; migration user lacks ownership.
--    Fix via Supabase Dashboard Security Advisor "Ask Assistant" or support.

-- ============================================================================
-- 1. PACKAGE_ANALYTICS - Recreate view with security_invoker (PostgreSQL 15+)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_my_package_stats();

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
