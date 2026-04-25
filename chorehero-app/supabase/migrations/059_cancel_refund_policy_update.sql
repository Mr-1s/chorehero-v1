-- Migration 059: Refund policy - 100% if cancelled within 1 hour of booking
-- Spec: Within 1 hour of booking → 100%; else use existing (24h/2h) logic

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
  v_hours_since_booking NUMERIC;
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

  -- Hours since booking was created
  v_hours_since_booking := EXTRACT(EPOCH FROM (NOW() - v_booking.created_at)) / 3600.0;
  -- Hours until scheduled start
  v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_time - NOW())) / 3600.0;

  -- Determine refund percentage
  IF p_refund_pct IS NOT NULL THEN
    v_refund_pct := GREATEST(0, LEAST(100, p_refund_pct));
  ELSIF p_cancelled_by = 'cleaner' THEN
    -- Cleaner cancels → always full refund to customer
    v_refund_pct := 100;
  ELSIF v_hours_since_booking < 1 THEN
    -- Within 1 hour of booking → 100% refund
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
