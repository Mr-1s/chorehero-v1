-- 001 created bookings.customer_id / cleaner_id without ON DELETE CASCADE.
-- 019 only adds constraints if missing — existing NO ACTION constraints block auth user deletion.
-- Recreate with CASCADE so delete-account (auth.admin.deleteUser) succeeds.

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_cleaner_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_customer_id_fkey
  FOREIGN KEY (customer_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_cleaner_id_fkey
  FOREIGN KEY (cleaner_id) REFERENCES public.users(id) ON DELETE CASCADE;
