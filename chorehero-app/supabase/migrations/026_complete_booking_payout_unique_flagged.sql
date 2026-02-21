-- Migration 026: complete_booking RPC, payout_queue unique, flagged_messages, feed RPC

-- ============================================================
-- 1. UNIQUE on payout_queue.booking_id for ON CONFLICT DO NOTHING
-- ============================================================
ALTER TABLE payout_queue DROP CONSTRAINT IF EXISTS payout_queue_booking_id_key;
DO $$
BEGIN
  ALTER TABLE payout_queue ADD CONSTRAINT payout_queue_booking_id_key UNIQUE (booking_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Fix enqueue trigger to use ON CONFLICT
CREATE OR REPLACE FUNCTION enqueue_cleaner_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO payout_queue (booking_id, cleaner_id, amount_cents, scheduled_at)
    VALUES (
      NEW.id,
      NEW.cleaner_id,
      ROUND(COALESCE(NEW.cleaner_earnings, 0) * 100)::INTEGER,
      NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. complete_booking RPC - cleaner marks job done (triggers payout enqueue)
-- ============================================================
CREATE OR REPLACE FUNCTION complete_booking(
  p_booking_id   UUID,
  p_cleaner_id   UUID,
  p_completed_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Booking not found');
  END IF;

  IF v_booking.cleaner_id != p_cleaner_id THEN
    RETURN json_build_object('success', FALSE, 'error', 'Unauthorized');
  END IF;

  IF v_booking.status != 'in_progress' THEN
    RETURN json_build_object('success', FALSE, 'error', 'Invalid status: must be in_progress');
  END IF;

  UPDATE bookings SET
    status      = 'completed',
    completed_at = p_completed_at,
    updated_at  = NOW()
  WHERE id = p_booking_id;

  RETURN json_build_object('success', TRUE);
END;
$$;

-- ============================================================
-- 3. flagged_messages for trust & safety (off-platform payment detection)
-- ============================================================
CREATE TABLE IF NOT EXISTS flagged_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
  message_id  UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
  sender_id   UUID REFERENCES users(id),
  content     TEXT,
  reason      TEXT NOT NULL DEFAULT 'off_platform_payment',
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flagged_messages_reason ON flagged_messages(reason);
CREATE INDEX IF NOT EXISTS idx_flagged_messages_reviewed ON flagged_messages(reviewed_at);

-- ============================================================
-- 4. get_ranked_cleaner_feed RPC - server-side feed ranking
-- ============================================================
CREATE OR REPLACE FUNCTION get_ranked_cleaner_feed(
  p_lat FLOAT DEFAULT NULL,
  p_lng FLOAT DEFAULT NULL,
  p_radius_km FLOAT DEFAULT 50,
  p_limit INT DEFAULT 20
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
    (cl.verification_status::text = 'verified' OR cl.verification_status IS NULL)
    AND cl.is_available = true
    AND cp.status = 'published'
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
