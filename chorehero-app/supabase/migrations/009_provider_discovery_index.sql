-- Provider Discovery Index for Explore
CREATE TABLE IF NOT EXISTS public.provider_discovery_index (
  provider_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_avatar_url TEXT,
  service_tags TEXT[] NOT NULL DEFAULT '{}',
  geohash TEXT,
  price_tiers INTEGER[] NOT NULL DEFAULT '{}',
  ranking_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_state TEXT NOT NULL CHECK (provider_state IN ('LIVE', 'INACTIVE')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_discovery_tags ON public.provider_discovery_index USING GIN (service_tags);
CREATE INDEX IF NOT EXISTS idx_provider_discovery_geohash ON public.provider_discovery_index (geohash);
CREATE INDEX IF NOT EXISTS idx_provider_discovery_state ON public.provider_discovery_index (provider_state);
CREATE INDEX IF NOT EXISTS idx_provider_discovery_price ON public.provider_discovery_index USING GIN (price_tiers);

DROP FUNCTION IF EXISTS explore_providers(text, text[], integer, integer, text, integer);

CREATE OR REPLACE FUNCTION explore_providers(
  query_text TEXT DEFAULT NULL,
  filter_service_tags TEXT[] DEFAULT NULL,
  price_min INTEGER DEFAULT NULL,
  price_max INTEGER DEFAULT NULL,
  sort_by TEXT DEFAULT 'rating',
  limit_count INTEGER DEFAULT 30
)
RETURNS TABLE (
  provider_id UUID,
  provider_name TEXT,
  provider_avatar_url TEXT,
  avg_rating NUMERIC,
  response_time_minutes INTEGER,
  completion_rate NUMERIC,
  price_tiers INTEGER[]
)
LANGUAGE SQL
STABLE
AS $$
  WITH query_tags AS (
    SELECT CASE
      WHEN query_text IS NULL OR length(trim(query_text)) = 0 THEN NULL
      ELSE regexp_split_to_array(lower(trim(query_text)), '\s+')
    END AS tags
  )
  SELECT
    p.provider_id,
    p.provider_name,
    p.provider_avatar_url,
    NULLIF(p.ranking_signals->>'avg_rating', '')::numeric AS avg_rating,
    NULLIF(p.ranking_signals->>'response_time_minutes', '')::integer AS response_time_minutes,
    NULLIF(p.ranking_signals->>'completion_rate', '')::numeric AS completion_rate,
    p.price_tiers
  FROM public.provider_discovery_index p
  CROSS JOIN query_tags qt
  WHERE p.provider_state = 'LIVE'
    AND (filter_service_tags IS NULL OR p.service_tags && filter_service_tags)
    AND (qt.tags IS NULL OR p.service_tags && qt.tags)
    AND (
      price_min IS NULL OR price_max IS NULL OR
      EXISTS (
        SELECT 1 FROM unnest(p.price_tiers) pt
        WHERE pt BETWEEN price_min AND price_max
      )
    )
  ORDER BY
    CASE
      WHEN sort_by = 'price' THEN (SELECT MIN(pt) FROM unnest(p.price_tiers) pt)
      WHEN sort_by = 'distance' THEN NULLIF(p.ranking_signals->>'response_time_minutes', '')::integer
      ELSE NULLIF(p.ranking_signals->>'avg_rating', '')::numeric
    END DESC NULLS LAST,
    p.provider_id ASC
  LIMIT limit_count;
$$;
