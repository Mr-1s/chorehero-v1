-- Ensure bookings.customer_id and bookings.cleaner_id have FKs to public.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_customer_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_customer_id_fkey
      FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_cleaner_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_cleaner_id_fkey
      FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
