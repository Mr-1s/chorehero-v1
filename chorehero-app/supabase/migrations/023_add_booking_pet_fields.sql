-- Add pet details to bookings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN IF NOT EXISTS has_pets BOOLEAN,
      ADD COLUMN IF NOT EXISTS pet_details TEXT;
  END IF;
END $$;
