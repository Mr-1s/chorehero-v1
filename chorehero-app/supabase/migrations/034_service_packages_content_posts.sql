-- Migration 034: Extend content_posts as service packages
-- Video upload becomes package creation; existing videos can be made bookable

-- Add package fields to content_posts
ALTER TABLE public.content_posts
  ADD COLUMN IF NOT EXISTS package_type TEXT CHECK (package_type IN ('fixed', 'estimate', 'hourly')),
  ADD COLUMN IF NOT EXISTS base_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS price_range JSONB,
  ADD COLUMN IF NOT EXISTS included_tasks TEXT[],
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS service_radius_miles INTEGER DEFAULT 25,
  ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_content_posts_bookable
  ON public.content_posts(is_bookable, user_id)
  WHERE is_bookable = true;

-- Link booking_templates to packages (content_posts) - only if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'booking_templates') THEN
    ALTER TABLE public.booking_templates
      ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.content_posts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_booking_templates_package_id
      ON public.booking_templates(package_id)
      WHERE package_id IS NOT NULL;
  END IF;
END $$;
