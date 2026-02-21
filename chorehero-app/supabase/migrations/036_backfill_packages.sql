-- Migration 036: Backfill existing cleaner videos as bookable packages
-- Converts existing content_posts from cleaners to hourly packages (safest default)

UPDATE public.content_posts cp
SET
  is_bookable = true,
  package_type = 'hourly',
  base_price_cents = (
    SELECT COALESCE(ROUND(cp2.hourly_rate * 100)::integer, 2500)
    FROM public.cleaner_profiles cp2
    WHERE cp2.user_id = cp.user_id
  ),
  service_radius_miles = (
    SELECT COALESCE(ROUND(cp2.service_radius_km / 1.60934)::integer, 25)
    FROM public.cleaner_profiles cp2
    WHERE cp2.user_id = cp.user_id
  )
WHERE
  cp.user_id IN (SELECT user_id FROM public.cleaner_profiles)
  AND (cp.is_bookable IS NULL OR cp.is_bookable = false)
  AND cp.status = 'published';
