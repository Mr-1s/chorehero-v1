-- Migration 037: Filter feed to bookable packages only
-- Show only content_posts that are bookable (or legacy without the column)

CREATE OR REPLACE FUNCTION get_ranked_cleaner_feed(
  p_lat FLOAT DEFAULT NULL,
  p_lng FLOAT DEFAULT NULL,
  p_radius_km FLOAT DEFAULT 50,
  p_limit INT DEFAULT 20,
  p_include_unverified BOOLEAN DEFAULT false
)
RETURNS TABLE (
  content_id UUID,
  user_id UUID,
  media_url TEXT,
  rank_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH cleaner_addrs AS (
    SELECT DISTINCT ON (a.user_id) a.user_id, a.latitude, a.longitude
    FROM addresses a
    WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
  ),
  avail_score AS (
    SELECT ca.cleaner_id,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM cleaner_availability ca2
          WHERE ca2.cleaner_id = ca.cleaner_id AND ca2.is_available
            AND ca2.start_time <= (NOW()::time) AND ca2.end_time >= (NOW()::time)
        ) THEN 1.0
        WHEN EXISTS (
          SELECT 1 FROM cleaner_availability ca2
          WHERE ca2.cleaner_id = ca.cleaner_id AND ca2.is_available
            AND ca2.day_of_week = EXTRACT(DOW FROM NOW())::int
        ) THEN 0.5
        ELSE 0.2
      END AS score
    FROM (SELECT DISTINCT user_id AS cleaner_id FROM cleaner_profiles) ca
  )
  SELECT
    cp.id AS content_id,
    cp.user_id,
    cp.media_url,
    (
      CASE
        WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND ca.latitude IS NOT NULL AND ca.longitude IS NOT NULL
        THEN (1 - LEAST(1.0, (
          SQRT(POWER((ca.longitude::float - p_lng) * 111.0 * COS(RADIANS(p_lat)), 2) +
               POWER((ca.latitude::float - p_lat) * 111.0, 2))
        ) / p_radius_km)) * 0.4
        ELSE 0.5
      END +
      (COALESCE(cl.rating_average, 3)::float / 5.0) * 0.3 +
      COALESCE((SELECT score FROM avail_score WHERE cleaner_id = cp.user_id), 0.2) * 0.2 +
      LEAST(LN(COALESCE(cp.view_count, 0) + 1)::float / 10, 1.0) * 0.1
    )::float AS rank_score
  FROM content_posts cp
  JOIN cleaner_profiles cl ON cp.user_id = cl.user_id
  LEFT JOIN cleaner_addrs ca ON cl.user_id = ca.user_id
  WHERE
    (p_include_unverified OR cl.verification_status::text = 'verified' OR cl.verification_status IS NULL OR cl.verification_status::text = 'pending')
    AND cl.is_available = true
    AND cp.status = 'published'
    AND (cp.is_bookable = true OR cp.is_bookable IS NULL)
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR ca.latitude IS NULL OR ca.longitude IS NULL
      OR SQRT(POWER((ca.longitude::float - p_lng) * 111.0 * COS(RADIANS(p_lat)), 2) +
               POWER((ca.latitude::float - p_lat) * 111.0, 2)) <= p_radius_km
    )
  ORDER BY rank_score DESC
  LIMIT p_limit;
END;
$$;
