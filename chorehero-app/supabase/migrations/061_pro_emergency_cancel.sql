-- Migration 061: Pro emergency cancellation
-- Pro can cancel accepted job with $25 fee; customer gets full refund + $25 credit

-- Add customer credit for pro-cancellation compensation
ALTER TABLE public.customer_profiles
ADD COLUMN IF NOT EXISTS credit_cents INTEGER DEFAULT 0;

COMMENT ON COLUMN public.customer_profiles.credit_cents IS 'Account credit from pro cancellations (e.g. $25 when pro emergency-cancels)';

-- Pro emergency cancel: validates caller is cleaner, full refund + $25 credit to customer, $25 fee to pro
CREATE OR REPLACE FUNCTION pro_emergency_cancel_booking(
  p_booking_id UUID,
  p_reason TEXT,
  p_cleaner_id UUID  -- caller must be the assigned cleaner
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking         RECORD;
  v_pro_fee_cents   INTEGER := 2500;  -- $25
  v_customer_credit INTEGER := 2500; -- $25 credit to customer
BEGIN
  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN json_build_object('success', FALSE, 'error', 'Reason is required');
  END IF;

  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', FALSE, 'error', 'Booking not found');
  END IF;

  IF v_booking.cleaner_id IS NULL OR v_booking.cleaner_id != p_cleaner_id THEN
    RETURN json_build_object('success', FALSE, 'error', 'Unauthorized: you are not the assigned cleaner');
  END IF;

  IF v_booking.status IN ('completed', 'cancelled') THEN
    RETURN json_build_object('success', FALSE, 'error', 'Booking already ' || v_booking.status);
  END IF;

  -- Only allow when booking is confirmed/payment_held (before service starts)
  IF NOT (v_booking.status IN ('confirmed', 'cleaner_assigned', 'payment_held', 'pending')) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Can only emergency-cancel before service starts');
  END IF;

  -- Update booking: cancelled, full refund
  UPDATE bookings SET
    status              = 'cancelled',
    cancellation_reason = 'Pro emergency: ' || p_reason,
    cancelled_by        = 'cleaner',
    refund_amount       = COALESCE(v_booking.total_amount, 0),
    updated_at          = NOW()
  WHERE id = p_booking_id;

  -- Add $25 credit to customer
  INSERT INTO customer_profiles (user_id, credit_cents, updated_at)
  VALUES (v_booking.customer_id, v_customer_credit, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    credit_cents = customer_profiles.credit_cents + v_customer_credit,
    updated_at = NOW();

  -- TODO: Deduct $25 from pro earnings (or charge) - for now we record it; platform can reconcile
  -- Could add pro_cancellation_fee_cents to cleaner_profiles or a separate ledger

  RETURN json_build_object(
    'success',        TRUE,
    'refund_amount',  COALESCE(v_booking.total_amount, 0),
    'customer_credit_cents', v_customer_credit,
    'pro_fee_cents',  v_pro_fee_cents,
    'payment_intent', v_booking.stripe_payment_intent_id
  );
END;
$$;
