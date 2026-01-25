-- Create user_profiles table if missing (used by BookingSummaryScreen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
  ) THEN
    CREATE TABLE public.user_profiles (
      user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
      address_line1 TEXT,
      city TEXT,
      state TEXT,
      zip_code TEXT,
      property_type TEXT,
      square_feet INTEGER,
      has_pets BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view own profile" ON public.user_profiles
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "Users can update own profile" ON public.user_profiles
      FOR UPDATE USING (auth.uid() = user_id);

    CREATE POLICY "Users can insert own profile" ON public.user_profiles
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
