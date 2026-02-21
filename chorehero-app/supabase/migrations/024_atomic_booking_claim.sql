-- Migration 024: Atomic booking claim + timezone + RLS hardening

-- 1. Timezone columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- 2. Cancellation fields
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('customer', 'cleaner', 'system'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2) DEFAULT 0;

-- 3. Atomic claim_booking RPC
-- Uses SELECT FOR UPDATE SKIP LOCKED so two concurrent calls cannot both succeed.
CREATE OR REPLACE FUNCTION claim_booking(p_booking_id UUID, p_cleaner_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking RECORD;
BEGIN
  -- Lock the exact row. SKIP LOCKED means a concurrent call returns nothing immediately.
  SELECT id INTO v_booking
  FROM bookings
  WHERE id = p_booking_id
    AND cleaner_id IS NULL
    AND status = 'pending'
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    -- Either already claimed or row is locked by concurrent request
    RETURN FALSE;
  END IF;

  UPDATE bookings
  SET
    cleaner_id  = p_cleaner_id,
    status      = 'confirmed',
    updated_at  = NOW()
  WHERE id = p_booking_id;

  RETURN TRUE;
END;
$$;

-- 4. Tighten RLS: replace the USING(true) policy on users
DROP POLICY IF EXISTS "Users can view others basic info" ON users;

-- Users can always see themselves
DROP POLICY IF EXISTS "users_see_self" ON users;
CREATE POLICY "users_see_self"
ON users FOR SELECT
USING (auth.uid() = id);

-- Customers can see verified, available cleaners (for discovery)
DROP POLICY IF EXISTS "customers_see_verified_cleaners" ON users;
CREATE POLICY "customers_see_verified_cleaners"
ON users FOR SELECT
USING (
  role = 'cleaner'
  AND EXISTS (
    SELECT 1 FROM cleaner_profiles cp
    WHERE cp.user_id = users.id
      AND cp.verification_status = 'verified'
  )
);

-- Any booking participant can see the other party
DROP POLICY IF EXISTS "booking_parties_see_each_other" ON users;
CREATE POLICY "booking_parties_see_each_other"
ON users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE
      (b.customer_id = auth.uid() AND b.cleaner_id = users.id)
      OR (b.cleaner_id = auth.uid() AND b.customer_id = users.id)
  )
);

-- 5. booking_locks: ensure index exists for fast expiry checks (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'booking_locks'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_booking_locks_expires_at ON public.booking_locks(expires_at);
  END IF;
END $$;
