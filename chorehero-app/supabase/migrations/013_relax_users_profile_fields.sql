-- Allow creating user profiles before full onboarding data exists
ALTER TABLE public.users
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN role DROP NOT NULL;
