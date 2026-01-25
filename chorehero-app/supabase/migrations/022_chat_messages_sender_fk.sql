-- Ensure PostgREST can join chat_messages.sender_id -> public.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    JOIN pg_class ft ON ft.oid = c.confrelid
    JOIN pg_namespace fn ON fn.oid = ft.relnamespace
    WHERE c.contype = 'f'
      AND t.relname = 'chat_messages'
      AND a.attname = 'sender_id'
      AND ft.relname = 'users'
      AND fn.nspname = 'public'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_messages_sender_id_fkey'
      AND convalidated = false
  ) THEN
    BEGIN
      ALTER TABLE public.chat_messages
        VALIDATE CONSTRAINT chat_messages_sender_id_fkey;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'chat_messages_sender_id_fkey validation skipped';
    END;
  END IF;
END $$;
