-- Migration 054: Quote-to-booking transaction flow
-- - job_id on bookings, transactions table, 48h payout hold

-- 1. Add job_id to bookings (link to source job when from quote)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_job_id ON public.bookings(job_id);

-- 2. Add message to quotes (optional pro message)
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS message TEXT;

-- 3. Transactions table (payout tracking per spec)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  pro_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  stripe_transfer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_booking ON public.transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pro ON public.transactions(pro_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Service role can manage transactions
DROP POLICY IF EXISTS "Service role can manage transactions" ON public.transactions;
CREATE POLICY "Service role can manage transactions" ON public.transactions
  FOR ALL USING (auth.role() = 'service_role');

-- Cleaners can view own transactions
DROP POLICY IF EXISTS "Cleaners can view own transactions" ON public.transactions;
CREATE POLICY "Cleaners can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = pro_id);

-- 4. Update enqueue_cleaner_payout: 48 hours hold (was 24)
CREATE OR REPLACE FUNCTION enqueue_cleaner_payout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO payout_queue (booking_id, cleaner_id, amount_cents, scheduled_at)
    VALUES (
      NEW.id,
      NEW.cleaner_id,
      ROUND(COALESCE(NEW.cleaner_earnings, 0) * 100)::INTEGER,
      NOW() + INTERVAL '48 hours'
    )
    ON CONFLICT (booking_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
