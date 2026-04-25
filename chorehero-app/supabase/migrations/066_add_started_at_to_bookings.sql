-- Migration 066: Add started_at to bookings (when cleaner marks job in progress)
-- Complements actual_start_time for semantic clarity; markInProgress sets this.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.started_at IS 'When the cleaner started the job (set when status changes to in_progress)';
