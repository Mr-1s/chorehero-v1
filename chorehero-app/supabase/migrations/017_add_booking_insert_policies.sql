-- Allow authenticated users to insert their own bookings/addresses/profiles
DROP POLICY IF EXISTS "Customers can insert own bookings" ON public.bookings;
CREATE POLICY "Customers can insert own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
CREATE POLICY "Users can insert own addresses" ON public.addresses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles') THEN
    DROP POLICY IF EXISTS "Users can upsert own profile" ON public.user_profiles;
    CREATE POLICY "Users can upsert own profile" ON public.user_profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
