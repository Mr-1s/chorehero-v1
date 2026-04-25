-- CLEANUP FOR LAUNCH
-- Run with caution in Supabase SQL Editor.
-- 1. Update CUTOFF_DATE below before running
-- 2. Alternative: Create fresh Supabase project, export schema only (no data), import, point app to new DB

-- CUTOFF: Delete all data created before this date (update before running)
-- Example: '2025-01-01' to keep only 2025 data
DO $$
DECLARE
  CUTOFF_DATE constant timestamptz := '2025-01-01'::timestamptz;
BEGIN
  -- Location updates
  DELETE FROM public.location_updates WHERE created_at < CUTOFF_DATE;

  -- Chat messages
  DELETE FROM public.chat_messages WHERE created_at < CUTOFF_DATE;

  -- Chat threads
  DELETE FROM public.chat_threads WHERE created_at < CUTOFF_DATE;

  -- Reviews
  DELETE FROM public.ratings WHERE created_at < CUTOFF_DATE;

  -- Notifications
  DELETE FROM public.notifications WHERE created_at < CUTOFF_DATE;

  -- Job media
  DELETE FROM public.job_media WHERE created_at < CUTOFF_DATE;

  -- Quotes
  DELETE FROM public.quotes WHERE created_at < CUTOFF_DATE;

  -- Bookings
  DELETE FROM public.bookings WHERE created_at < CUTOFF_DATE;

  -- Jobs
  DELETE FROM public.jobs WHERE created_at < CUTOFF_DATE;
END $$;

-- Storage: Run supabase functions invoke cleanup-storage to remove orphaned files
