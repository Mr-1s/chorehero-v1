-- Ensure cleaner_profiles.user_id has a foreign key to public.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cleaner_profiles_user_id_fkey'
  ) THEN
    ALTER TABLE public.cleaner_profiles
      ADD CONSTRAINT cleaner_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;
