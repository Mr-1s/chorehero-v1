-- Migration 031: No-show tracking and cleanup
-- Add columns to cleaner_profiles, add trigger for cleaner_no_show status

-- ============================================================
-- 1. Add no_show_count and reliability_score to cleaner_profiles
-- ============================================================
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS no_show_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_score INTEGER DEFAULT 100;

-- ============================================================
-- 2. Add cleaner_no_show to booking status enum
-- ============================================================
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'cleaner_no_show';

-- ============================================================
-- 3. Trigger: when status changes to cleaner_no_show, update
--    cleaner profile and optionally auto-cancel
-- ============================================================
CREATE OR REPLACE FUNCTION check_no_show()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cleaner_no_show' THEN
    UPDATE cleaner_profiles
    SET
      no_show_count = COALESCE(no_show_count, 0) + 1,
      reliability_score = GREATEST(0, COALESCE(reliability_score, 100) - 20)
    WHERE user_id = NEW.cleaner_id;

    NEW.status := 'cancelled';
    NEW.cancellation_reason := 'Cleaner no-show detected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_no_show ON bookings;
CREATE TRIGGER on_booking_no_show
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_no_show();

-- ============================================================
-- 4. notify_customer_delay: RPC for cleaners to notify "Running late"
-- ============================================================
CREATE OR REPLACE FUNCTION notify_customer_delay(
  p_booking_id UUID,
  p_delay_minutes INTEGER DEFAULT 15
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_cleaner_name TEXT;
BEGIN
  SELECT b.customer_id, u.name
  INTO v_customer_id, v_cleaner_name
  FROM bookings b
  JOIN users u ON u.id = b.cleaner_id
  WHERE b.id = p_booking_id
    AND b.cleaner_id = auth.uid();

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data, created_at)
  VALUES (
    v_customer_id,
    'booking_update',
    'Running late',
    COALESCE(v_cleaner_name, 'Your cleaner') || ' is running about ' || p_delay_minutes || ' minutes late.',
    jsonb_build_object('booking_id', p_booking_id, 'delay_minutes', p_delay_minutes),
    NOW()
  );

  RETURN TRUE;
END;
$$;
