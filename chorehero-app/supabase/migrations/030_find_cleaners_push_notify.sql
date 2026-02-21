-- Migration 030: find_cleaners_for_job RPC + notify cleaners of new marketplace jobs
-- Used for push notifications when a new pending booking is created (marketplace mode, no cleaner assigned)

-- ============================================================
-- 1. find_cleaners_for_job: Returns cleaner user_ids within radius
-- ============================================================
CREATE OR REPLACE FUNCTION find_cleaners_for_job(
  p_lat FLOAT,
  p_lng FLOAT,
  p_service_type TEXT DEFAULT NULL,
  p_radius_km FLOAT DEFAULT 50
)
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH cleaner_addrs AS (
    SELECT DISTINCT ON (a.user_id) a.user_id, a.latitude, a.longitude
    FROM addresses a
    WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
  )
  SELECT cp.user_id
  FROM cleaner_profiles cp
  JOIN cleaner_addrs ca ON cp.user_id = ca.user_id
  WHERE cp.is_available = true
    AND (cp.verification_status::text IN ('verified', 'pending') OR cp.verification_status IS NULL)
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR ca.latitude IS NULL OR ca.longitude IS NULL
      OR SQRT(
        POWER((ca.longitude::float - p_lng) * 111.0 * COS(RADIANS(p_lat)), 2) +
        POWER((ca.latitude::float - p_lat) * 111.0, 2)
      ) <= p_radius_km
    );
END;
$$;

-- ============================================================
-- 2. notify_cleaners_new_job: Called by trigger on booking INSERT
--    Inserts notifications for cleaners in radius (marketplace jobs only)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_cleaners_new_job()
RETURNS TRIGGER AS $$
DECLARE
  v_lat FLOAT;
  v_lng FLOAT;
  v_cleaner_id UUID;
  v_service_type TEXT;
  v_total NUMERIC;
  v_scheduled TEXT;
BEGIN
  -- Only for marketplace jobs: pending, no cleaner assigned
  IF NEW.status != 'pending' OR NEW.cleaner_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get address coordinates
  SELECT a.latitude::float, a.longitude::float
  INTO v_lat, v_lng
  FROM addresses a
  WHERE a.id = NEW.address_id;

  -- Skip if no coordinates (can't match cleaners)
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN NEW;
  END IF;

  v_service_type := COALESCE(NEW.service_type, 'Cleaning');
  v_total := COALESCE(NEW.total_amount, 0);
  v_scheduled := to_char(NEW.scheduled_time AT TIME ZONE 'UTC', 'Mon DD, HH12:MI AM');

  -- Insert notification for each matched cleaner
  FOR v_cleaner_id IN
    SELECT find_cleaners_for_job.user_id
    FROM find_cleaners_for_job(v_lat, v_lng, v_service_type, 50)
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_cleaner_id,
      'booking_request',
      'New cleaning job available!',
      '$' || ROUND(v_total, 2) || ' - ' || v_service_type || ' on ' || v_scheduled,
      jsonb_build_object(
        'type', 'new_booking',
        'booking_id', NEW.id,
        'service_type', v_service_type,
        'total_amount', v_total,
        'scheduled_time', NEW.scheduled_time
      ),
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_insert_notify_cleaners ON bookings;
CREATE TRIGGER on_booking_insert_notify_cleaners
  AFTER INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION notify_cleaners_new_job();
