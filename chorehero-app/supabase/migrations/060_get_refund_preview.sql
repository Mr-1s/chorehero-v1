-- Migration 060: Get refund preview (no cancellation)
-- Returns expected refund amount for customer cancellation without actually cancelling

CREATE OR REPLACE FUNCTION get_cancel_refund_preview(
  p_booking_id UUID,
  p_cancelled_by TEXT DEFAULT 'customer'
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
  SELECT id, total_amount, scheduled_time, created_at
  INTO v_booking
  FROM bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Booking not found');
  END IF;

  IF v_booking.status IN ('completed', 'cancelled') THEN
    RETURN json_build_object('success', FALSE, 'error', 'Booking already ' || v_booking.status);
  END IF;

  v_hours_since_booking := EXTRACT(EPOCH FROM (NOW() - v_booking.created_at)) / 3600.0;
  v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_time - NOW())) / 3600.0;

  IF p_cancelled_by = 'cleaner' THEN
    v_refund_pct := 100;
  ELSIF v_hours_since_booking < 1 THEN
    v_refund_pct := 100;
  ELSIF v_hours_until > 24 THEN
    v_refund_pct := 100;
  ELSIF v_hours_until > 2 THEN
    v_refund_pct := 50;
  ELSE
    v_refund_pct := 0;
  END IF;

  v_refund_amount := ROUND((COALESCE(v_booking.total_amount, 0) * v_refund_pct / 100.0)::numeric, 2);

  RETURN json_build_object(
    'success',       TRUE,
    'refund_pct',    v_refund_pct,
    'refund_amount', v_refund_amount
  );
END;
$$;
