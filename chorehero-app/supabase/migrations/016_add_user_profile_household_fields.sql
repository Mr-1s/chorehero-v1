-- Add household fields for booking summary prefill
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN IF NOT EXISTS property_type TEXT,
      ADD COLUMN IF NOT EXISTS square_feet INTEGER,
      ADD COLUMN IF NOT EXISTS has_pets BOOLEAN;
  END IF;
END $$;
