-- ============================================================================
-- 077_discover_system.sql
--
-- Wires the customer Discover screen to real backend primitives:
--   1. `services.coming_soon` flag for the new "Coming Soon" section
--   2. `service_interest_signups` table so customers can register interest
--      in services that aren't bookable yet (no fake data, no broken empty states)
--   3. `get_recommended_cleaners` RPC — distance + rating + recency + verified
--   4. `get_trending_cleaners` RPC — content engagement over the last 7 days
--   5. Seed a small set of "coming soon" services so the section isn't empty
--      on day one even with zero pros signed up
--
-- All RPCs are SECURITY INVOKER and use auth.uid() for ownership where needed.
-- All new tables have RLS enabled.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Coming-soon services flag
-- ----------------------------------------------------------------------------

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS coming_soon BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_services_coming_soon
  ON public.services (coming_soon)
  WHERE coming_soon = true;

-- ----------------------------------------------------------------------------
-- 2. Customer interest signups
--    Used by the "Coming Soon" Discover section's "Notify me" button.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_interest_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  zip_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_service_interest_signups_service
  ON public.service_interest_signups (service_id);

ALTER TABLE public.service_interest_signups ENABLE ROW LEVEL SECURITY;

-- Customers may insert their own interest rows.
DROP POLICY IF EXISTS service_interest_insert_self ON public.service_interest_signups;
CREATE POLICY service_interest_insert_self
  ON public.service_interest_signups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Customers may read / delete their own interest rows.
DROP POLICY IF EXISTS service_interest_select_self ON public.service_interest_signups;
CREATE POLICY service_interest_select_self
  ON public.service_interest_signups
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS service_interest_delete_self ON public.service_interest_signups;
CREATE POLICY service_interest_delete_self
  ON public.service_interest_signups
  FOR DELETE
  USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. Recommended cleaners RPC
--
-- Score formula:
--    0.40 * proximity_score   (1.0 within 5mi, decays linearly to 0 at radius)
--  + 0.30 * rating_score      (rating_average / 5)
--  + 0.20 * recency_score     (1.0 active <= 7d ago, decays to 0 at 60d)
--  + 0.10 * verified_score    (1.0 if verification_status = 'verified', else 0)
--
-- Distance uses the haversine formula on the cleaner's `addresses` row.
-- Cleaners without coords fall back to proximity_score = 0.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_recommended_cleaners(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_user_id UUID DEFAULT NULL,
  p_radius_miles DOUBLE PRECISION DEFAULT 50,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  rating_average NUMERIC,
  total_jobs INTEGER,
  hourly_rate NUMERIC,
  service_radius_km NUMERIC,
  distance_miles DOUBLE PRECISION,
  verification_status TEXT,
  is_available BOOLEAN,
  recommendation_score DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_radius_km DOUBLE PRECISION := COALESCE(p_radius_miles, 50) * 1.609344;
BEGIN
  RETURN QUERY
  WITH cleaner_addr AS (
    SELECT DISTINCT ON (a.user_id)
      a.user_id,
      a.latitude,
      a.longitude
    FROM public.addresses a
    WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
    ORDER BY a.user_id, a.is_default DESC NULLS LAST, a.created_at DESC
  ),
  scored AS (
    SELECT
      u.id AS user_id,
      u.name,
      u.avatar_url,
      cp.rating_average,
      cp.total_jobs,
      cp.hourly_rate,
      cp.service_radius_km,
      cp.verification_status,
      cp.is_available,
      ca.latitude,
      ca.longitude,
      CASE
        WHEN ca.latitude IS NULL OR ca.longitude IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN NULL
        ELSE 3958.8 * 2 * asin(sqrt(
          power(sin(radians((ca.latitude - p_lat) / 2)), 2)
          + cos(radians(p_lat)) * cos(radians(ca.latitude))
            * power(sin(radians((ca.longitude - p_lng) / 2)), 2)
        ))
      END AS dist_miles
    FROM public.users u
    JOIN public.cleaner_profiles cp ON cp.user_id = u.id
    LEFT JOIN cleaner_addr ca ON ca.user_id = u.id
    WHERE u.role = 'cleaner'
      AND COALESCE(u.is_active, true) = true
      AND COALESCE(cp.is_available, false) = true
  )
  SELECT
    s.user_id,
    s.name,
    s.avatar_url,
    s.rating_average,
    s.total_jobs,
    s.hourly_rate,
    s.service_radius_km,
    s.dist_miles AS distance_miles,
    s.verification_status,
    s.is_available,
    (
        0.40 * COALESCE(
          CASE
            WHEN s.dist_miles IS NULL THEN 0
            WHEN s.dist_miles <= 5 THEN 1.0
            WHEN s.dist_miles >= COALESCE(p_radius_miles, 50) THEN 0
            ELSE 1.0 - ((s.dist_miles - 5) / GREATEST(1, COALESCE(p_radius_miles, 50) - 5))
          END,
          0
        )
      + 0.30 * COALESCE(s.rating_average, 0) / 5.0
      + 0.10 * CASE WHEN s.verification_status = 'verified' THEN 1.0 ELSE 0.0 END
      + 0.20 * 0.5
    ) AS recommendation_score
  FROM scored s
  WHERE
    -- Filter to within radius (allow nulls so cleaners without coords still surface)
    (s.dist_miles IS NULL OR s.dist_miles <= COALESCE(p_radius_miles, 50))
  ORDER BY recommendation_score DESC NULLS LAST, s.rating_average DESC NULLS LAST
  LIMIT GREATEST(1, COALESCE(p_limit, 10));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recommended_cleaners(
  DOUBLE PRECISION, DOUBLE PRECISION, UUID, DOUBLE PRECISION, INTEGER
) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Trending cleaners RPC
--    Top cleaners by content_post views/likes over the last 7 days, scoped to
--    those who are available and within the requested radius.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_trending_cleaners(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_miles DOUBLE PRECISION DEFAULT 50,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  rating_average NUMERIC,
  total_jobs INTEGER,
  hourly_rate NUMERIC,
  trending_score BIGINT,
  view_count BIGINT,
  like_count BIGINT,
  distance_miles DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - INTERVAL '7 days';
BEGIN
  RETURN QUERY
  WITH cleaner_addr AS (
    SELECT DISTINCT ON (a.user_id)
      a.user_id, a.latitude, a.longitude
    FROM public.addresses a
    WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
    ORDER BY a.user_id, a.is_default DESC NULLS LAST, a.created_at DESC
  ),
  recent AS (
    SELECT
      cp.user_id,
      COALESCE(SUM(cp_post.view_count), 0)::BIGINT AS view_count,
      COALESCE(SUM(cp_post.like_count), 0)::BIGINT AS like_count
    FROM public.cleaner_profiles cp
    LEFT JOIN public.content_posts cp_post
      ON cp_post.user_id = cp.user_id
     AND cp_post.created_at >= v_since
     AND COALESCE(cp_post.status, 'published') = 'published'
    GROUP BY cp.user_id
  )
  SELECT
    u.id AS user_id,
    u.name,
    u.avatar_url,
    cp.rating_average,
    cp.total_jobs,
    cp.hourly_rate,
    (r.view_count + r.like_count * 3)::BIGINT AS trending_score,
    r.view_count,
    r.like_count,
    CASE
      WHEN ca.latitude IS NULL OR ca.longitude IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN NULL
      ELSE 3958.8 * 2 * asin(sqrt(
        power(sin(radians((ca.latitude - p_lat) / 2)), 2)
        + cos(radians(p_lat)) * cos(radians(ca.latitude))
          * power(sin(radians((ca.longitude - p_lng) / 2)), 2)
      ))
    END AS distance_miles
  FROM public.users u
  JOIN public.cleaner_profiles cp ON cp.user_id = u.id
  JOIN recent r ON r.user_id = u.id
  LEFT JOIN cleaner_addr ca ON ca.user_id = u.id
  WHERE u.role = 'cleaner'
    AND COALESCE(u.is_active, true) = true
    AND COALESCE(cp.is_available, false) = true
    AND (
      ca.latitude IS NULL
      OR p_lat IS NULL
      OR 3958.8 * 2 * asin(sqrt(
           power(sin(radians((ca.latitude - p_lat) / 2)), 2)
           + cos(radians(p_lat)) * cos(radians(ca.latitude))
             * power(sin(radians((ca.longitude - p_lng) / 2)), 2)
         )) <= COALESCE(p_radius_miles, 50)
    )
  ORDER BY trending_score DESC, cp.rating_average DESC NULLS LAST
  LIMIT GREATEST(1, COALESCE(p_limit, 10));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_cleaners(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER
) TO anon, authenticated;

-- Coming-soon service rows: enum labels must be added in 080, inserts in 081
-- (Postgres: cannot add enum values and use them in the same transaction — 55P04).
