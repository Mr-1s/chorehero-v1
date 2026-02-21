-- Migration 029: Security fixes from audit
-- 1. Stripe Connect RLS
-- 2. Self-booking prevention
-- 3. Content tables already have appropriate policies (004)

-- ============================================================
-- 1. STRIPE CONNECT ACCOUNTS RLS (if table exists)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'stripe_connect_accounts'
  ) THEN
    ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Public can view Connect accounts" ON public.stripe_connect_accounts;
    DROP POLICY IF EXISTS "Authenticated can view Connect accounts" ON public.stripe_connect_accounts;

    DROP POLICY IF EXISTS "Cleaners can view own Connect account" ON public.stripe_connect_accounts;
    CREATE POLICY "Cleaners can view own Connect account"
      ON public.stripe_connect_accounts FOR SELECT
      USING (auth.uid() = user_id);

    -- Service role (Edge Functions) can manage via service_role key - no policy needed for that
    -- RLS allows service_role to bypass
  END IF;
END $$;

-- ============================================================
-- 2. SELF-BOOKING PREVENTION
-- ============================================================
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS chk_no_self_booking;
ALTER TABLE public.bookings ADD CONSTRAINT chk_no_self_booking
  CHECK (cleaner_id IS NULL OR cleaner_id != customer_id);
