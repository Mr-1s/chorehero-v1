-- Migration 027: Pre-launch audit fixes
-- 1. Payout queue partial unique (allow retries/milestone payments)
-- 2. DB-level chat keyword filter (defense in depth)
-- 3. Feed cold start: p_include_unverified
-- 4. Cron logs for monitoring
-- 5. Booking complete notification trigger

-- ============================================================
-- 1. PAYOUT QUEUE: Partial unique (one pending per booking, allow retries)
-- ============================================================
ALTER TABLE payout_queue DROP CONSTRAINT IF EXISTS payout_queue_booking_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_payout
  ON payout_queue(booking_id) WHERE status = 'pending';

-- enqueue_cleaner_payout uses ON CONFLICT (booking_id) - works with partial index
-- (only one pending row per booking_id allowed)

-- ============================================================
-- 2. DB-LEVEL CHAT KEYWORD FILTER (blocks bypass via direct Supabase calls)
-- ============================================================
CREATE OR REPLACE FUNCTION check_message_content()
RETURNS TRIGGER AS $$
DECLARE
  forbidden_words TEXT[] := ARRAY[
    'venmo', 'cash', 'zelle', 'paypal', 'off app', 'off-platform', 'pay me directly'
  ];
  word TEXT;
BEGIN
  IF NEW.message_type = 'text' AND NEW.content IS NOT NULL THEN
    FOREACH word IN ARRAY forbidden_words LOOP
      IF NEW.content ILIKE '%' || word || '%' THEN
        INSERT INTO flagged_messages (thread_id, sender_id, content, reason)
        VALUES (NEW.thread_id, NEW.sender_id, LEFT(NEW.content, 500), 'off_platform_payment');
        RAISE EXCEPTION 'Off-platform payment discussion is not allowed. Please keep payments on-platform for your safety.'
          USING ERRCODE = 'check_violation';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_message_content ON chat_messages;
CREATE TRIGGER trg_check_message_content
  BEFORE INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION check_message_content();

-- ============================================================
-- 3. FEED COLD START: p_include_unverified for launch day
-- ============================================================
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

-- ============================================================
-- 4. CRON LOGS for monitoring (alert if no log in 2+ hours)
-- ============================================================
CREATE TABLE IF NOT EXISTS cron_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  processed_count INT DEFAULT 0,
  failed_count   INT DEFAULT 0,
  duration_ms    INT,
  ran_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata       JSONB
);

CREATE INDEX IF NOT EXISTS idx_cron_logs_function_ran ON cron_logs(function_name, ran_at DESC);

-- ============================================================
-- 5. BOOKING COMPLETE: Notify cleaner (payout ETA) and customer (review)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_booking_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_cleaner_earnings NUMERIC;
  v_cleaner_id UUID;
  v_customer_id UUID;
  v_cleaner_name TEXT;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_cleaner_earnings := COALESCE(NEW.cleaner_earnings, 0);
    v_cleaner_id := NEW.cleaner_id;
    v_customer_id := NEW.customer_id;

    SELECT name INTO v_cleaner_name FROM users WHERE id = v_cleaner_id;

    -- Notify cleaner: payout in 24 hours
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_cleaner_id,
      'booking_update',
      'Job complete!',
      'Payout of $' || ROUND(v_cleaner_earnings, 2) || ' scheduled in 24 hours.',
      jsonb_build_object('booking_id', NEW.id, 'payout_amount', v_cleaner_earnings),
      NOW()
    );

    -- Notify customer: leave a review
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_customer_id,
      'booking_update',
      'How was your cleaning?',
      'Your cleaning with ' || COALESCE(v_cleaner_name, 'your cleaner') || ' is complete. Tap to leave a review.',
      jsonb_build_object('booking_id', NEW.id, 'from_user_id', v_cleaner_id),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_completed_notify ON bookings;
CREATE TRIGGER on_booking_completed_notify
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION notify_booking_completed();
