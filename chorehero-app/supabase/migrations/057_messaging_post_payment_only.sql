-- Migration 057: Post-payment-only messaging
-- Messaging unlocks ONLY after customer pays (booking confirmed)

-- Add messaging_enabled to bookings (default false for existing rows)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS messaging_enabled BOOLEAN DEFAULT false;

-- Backfill: set messaging_enabled=true for existing confirmed/completed bookings
UPDATE public.bookings
SET messaging_enabled = true
WHERE messaging_enabled IS NOT TRUE
  AND status IN ('confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress', 'completed')
  AND stripe_payment_intent_id IS NOT NULL;

-- Replace chat_threads INSERT policy: require booking_id + messaging_enabled for post-payment chat
-- Remove pre-booking (booking_id IS NULL) branch - messaging is post-payment only
DROP POLICY IF EXISTS "Users can create chat threads" ON public.chat_threads;
CREATE POLICY "Users can create chat threads" ON public.chat_threads FOR INSERT WITH CHECK (
  (auth.uid() = customer_id OR auth.uid() = cleaner_id)
  AND chat_threads.booking_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = chat_threads.booking_id
    AND (b.customer_id = auth.uid() OR b.cleaner_id = auth.uid())
    AND b.messaging_enabled = true
  )
);
