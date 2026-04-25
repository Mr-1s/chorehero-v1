-- Migration 056: Allow chat threads without booking (for quote/pre-booking conversations)
-- Fixes: "new row violates row-level security policy for table chat_threads"
-- Customer and pro need to message before payment (e.g. about a quote)

DROP POLICY IF EXISTS "Users can create chat threads" ON public.chat_threads;
CREATE POLICY "Users can create chat threads" ON public.chat_threads FOR INSERT WITH CHECK (
  (auth.uid() = customer_id OR auth.uid() = cleaner_id)
  AND (
    chat_threads.booking_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = chat_threads.booking_id
      AND (b.customer_id = auth.uid() OR b.cleaner_id = auth.uid())
    )
  )
);
