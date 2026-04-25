-- Stripe Customer id for saved payment methods / SetupIntents
-- (Was duplicate version 055 with 055_quotes_...; renumbered 079 for migration history)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN public.users.stripe_customer_id IS 'Stripe Customer cus_* for payment methods';
