-- Add background check status tracking for cleaners
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'background_check_status') THEN
    CREATE TYPE background_check_status AS ENUM ('pending', 'in_progress', 'cleared', 'failed');
  END IF;
END $$;

ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS background_check_status background_check_status DEFAULT 'pending';
