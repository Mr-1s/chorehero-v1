-- Migration 035: Add package_id to bookings + backfill existing content

-- Link bookings to packages (content_posts)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.content_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_package_id
  ON public.bookings(package_id)
  WHERE package_id IS NOT NULL;
