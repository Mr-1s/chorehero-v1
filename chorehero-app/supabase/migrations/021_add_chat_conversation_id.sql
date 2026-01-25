-- Add conversation_id for unified chat threads
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'chat_threads'
  ) THEN
    ALTER TABLE public.chat_threads
      ADD COLUMN IF NOT EXISTS conversation_id TEXT;

    UPDATE public.chat_threads
    SET conversation_id = LEAST(customer_id::text, cleaner_id::text) || '_' || GREATEST(customer_id::text, cleaner_id::text)
    WHERE conversation_id IS NULL
      AND customer_id IS NOT NULL
      AND cleaner_id IS NOT NULL;

    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chat_threads_booking_id_key'
    ) THEN
      ALTER TABLE public.chat_threads DROP CONSTRAINT chat_threads_booking_id_key;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'chat_threads_conversation_id_key'
    ) THEN
      ALTER TABLE public.chat_threads
        ADD CONSTRAINT chat_threads_conversation_id_key UNIQUE (conversation_id);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chat_threads_conversation_id_idx
  ON public.chat_threads(conversation_id);
