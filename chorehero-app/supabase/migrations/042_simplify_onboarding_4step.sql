-- Migration 042: 4-step onboarding support
-- Add provides_equipment, provides_supplies to cleaner_profiles
-- Add 'contact' to content_posts package_type
-- Keep hourly_rate for backward compatibility (derive from first package when available)

-- Add equipment/supplies toggles to cleaner_profiles
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS provides_equipment BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS provides_supplies BOOLEAN DEFAULT true;

-- Add 'contact' to package_type constraint on content_posts
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.content_posts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%package_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.content_posts DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE public.content_posts
    ADD CONSTRAINT content_posts_package_type_check
    CHECK (package_type IS NULL OR package_type IN ('fixed', 'estimate', 'hourly', 'contact'));
EXCEPTION
  WHEN duplicate_object THEN NULL; -- Already applied
END $$;
