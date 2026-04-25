-- Marketplace / app fields on cleaner_profiles (were in add_cleaner_profile_columns.sql but never migrated)
-- Apply in Supabase SQL editor or via `supabase db push` so PostgREST schema cache includes these columns.

ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS coverage_area TEXT;

ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS available_services TEXT[];

ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS instant_booking BOOLEAN DEFAULT false;
