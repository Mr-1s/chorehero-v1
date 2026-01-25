-- Allow authenticated users to insert their own bookings/addresses/profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bookings'
      AND policyname = 'Customers can insert own bookings'
  ) THEN
    CREATE POLICY "Customers can insert own bookings" ON public.bookings
      FOR INSERT WITH CHECK (auth.uid() = customer_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'addresses'
      AND policyname = 'Users can insert own addresses'
  ) THEN
    CREATE POLICY "Users can insert own addresses" ON public.addresses
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'Users can upsert own profile'
  ) THEN
    CREATE POLICY "Users can upsert own profile" ON public.user_profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
