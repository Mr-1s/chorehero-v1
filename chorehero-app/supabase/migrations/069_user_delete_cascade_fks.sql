-- Ensure deleting auth.users → public.users cascades through dependent rows without FK violations.
-- Safe to re-run: drops named constraints if present and re-adds with ON DELETE CASCADE.

-- chat_threads: both participants reference users
ALTER TABLE public.chat_threads DROP CONSTRAINT IF EXISTS chat_threads_customer_id_fkey;
ALTER TABLE public.chat_threads DROP CONSTRAINT IF EXISTS chat_threads_cleaner_id_fkey;
ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_cleaner_id_fkey
    FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ratings (per-booking reviews)
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_rater_id_fkey;
ALTER TABLE public.ratings DROP CONSTRAINT IF EXISTS ratings_rated_id_fkey;
ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_rater_id_fkey
    FOREIGN KEY (rater_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_rated_id_fkey
    FOREIGN KEY (rated_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- payout queue rows for this cleaner
ALTER TABLE public.payout_queue DROP CONSTRAINT IF EXISTS payout_queue_cleaner_id_fkey;
ALTER TABLE public.payout_queue
  ADD CONSTRAINT payout_queue_cleaner_id_fkey
    FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- flagged_messages sender
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'flagged_messages'
  ) THEN
    ALTER TABLE public.flagged_messages DROP CONSTRAINT IF EXISTS flagged_messages_sender_id_fkey;
    ALTER TABLE public.flagged_messages
      ADD CONSTRAINT flagged_messages_sender_id_fkey
        FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
