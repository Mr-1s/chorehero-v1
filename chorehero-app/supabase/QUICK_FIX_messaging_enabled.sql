-- Quick fix: Add messaging_enabled column if missing
-- Run this in Supabase Dashboard → SQL Editor if you get "column bookings.messaging_enabled does not exist"

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS messaging_enabled BOOLEAN DEFAULT false;

-- Backfill existing paid bookings
UPDATE public.bookings
SET messaging_enabled = true
WHERE messaging_enabled IS NOT TRUE
  AND status IN ('confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress', 'completed')
  AND stripe_payment_intent_id IS NOT NULL;
