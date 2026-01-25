-- Add property details to bookings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
  ) THEN
    ALTER TABLE public.bookings
      ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
      ADD COLUMN IF NOT EXISTS bathrooms NUMERIC(3,1),
      ADD COLUMN IF NOT EXISTS square_feet INTEGER;
  END IF;
END $$;
