-- Migration 025: Rating trigger, escrow capture, cancellation RPC

-- ============================================================
-- 1. AUTO-UPDATE cleaner rating average on new review
-- ============================================================
CREATE OR REPLACE FUNCTION update_cleaner_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cleaner_profiles
  SET
    rating_average = (
      SELECT ROUND(AVG(rating)::numeric, 2)
      FROM ratings
      WHERE rated_id = NEW.rated_id
        AND is_visible = TRUE
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM ratings
      WHERE rated_id = NEW.rated_id
        AND is_visible = TRUE
    )
  WHERE user_id = NEW.rated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rating_inserted ON ratings;
CREATE TRIGGER on_rating_inserted
  AFTER INSERT OR UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION update_cleaner_rating();

-- ============================================================
-- 2. ESCROW: capture payment after job completion
--    Called by server/webhook when booking status → 'completed'
-- ============================================================
CREATE OR REPLACE FUNCTION capture_booking_payment(
  p_booking_id UUID,
  p_payment_intent_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE bookings
  SET
    payment_status = 'captured',
    updated_at     = NOW()
  WHERE id = p_booking_id
    AND stripe_payment_intent_id = p_payment_intent_id
    AND payment_status IN ('authorized', 'pending');

  RETURN FOUND;
END;
$$;

-- ============================================================
-- 3. CANCELLATION with time-based refund policy
--    Policy:
--      > 24 hrs before job → 100% refund
--      2–24 hrs before job → 50% refund
--      < 2 hrs / already started → 0% refund
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_booking_with_refund(
  p_booking_id   UUID,
  p_reason       TEXT,
  p_cancelled_by TEXT,  -- 'customer' | 'cleaner' | 'system'
  p_refund_pct   INTEGER DEFAULT NULL  -- override (0-100); NULL = auto from policy
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking         RECORD;
  v_hours_until     NUMERIC;
  v_refund_pct      INTEGER;
  v_refund_amount   NUMERIC;
BEGIN
  -- Fetch booking (lock row)
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Booking not found');
  END IF;

  IF v_booking.status IN ('completed', 'cancelled') THEN
    RETURN json_build_object('success', FALSE, 'error', 'Booking already ' || v_booking.status);
  END IF;

  -- Calculate hours until scheduled start
  v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_time - NOW())) / 3600.0;

  -- Determine refund percentage
  IF p_refund_pct IS NOT NULL THEN
    v_refund_pct := GREATEST(0, LEAST(100, p_refund_pct));
  ELSIF p_cancelled_by = 'cleaner' THEN
    -- Cleaner cancels → always full refund to customer
    v_refund_pct := 100;
  ELSIF v_hours_until > 24 THEN
    v_refund_pct := 100;
  ELSIF v_hours_until > 2 THEN
    v_refund_pct := 50;
  ELSE
    v_refund_pct := 0;
  END IF;

  v_refund_amount := ROUND((COALESCE(v_booking.total_amount, 0) * v_refund_pct / 100.0)::numeric, 2);

  -- Update booking
  UPDATE bookings SET
    status              = 'cancelled',
    cancellation_reason = p_reason,
    cancelled_by        = p_cancelled_by,
    refund_amount       = v_refund_amount,
    updated_at          = NOW()
  WHERE id = p_booking_id;

  RETURN json_build_object(
    'success',        TRUE,
    'refund_pct',     v_refund_pct,
    'refund_amount',  v_refund_amount,
    'payment_intent', v_booking.stripe_payment_intent_id,
    'payment_status', v_booking.payment_status
  );
END;
$$;

-- ============================================================
-- 4. Release funds to cleaner (called 24-48 hrs post-completion)
--    Records payout intent so Edge Function can call Stripe Transfer
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_queue (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id),
  cleaner_id   UUID NOT NULL REFERENCES users(id),
  amount_cents INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_transfer_id TEXT,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  processed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_queue_status_scheduled
  ON payout_queue(status, scheduled_at);

-- Automatically enqueue payout when booking is completed
CREATE OR REPLACE FUNCTION enqueue_cleaner_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    INSERT INTO payout_queue (booking_id, cleaner_id, amount_cents, scheduled_at)
    VALUES (
      NEW.id,
      NEW.cleaner_id,
      ROUND(COALESCE(NEW.cleaner_earnings, 0) * 100)::INTEGER,
      NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_booking_completed ON bookings;
CREATE TRIGGER on_booking_completed
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION enqueue_cleaner_payout();
