-- Migration 063: Add completed_at to bookings (required by complete_booking RPC)
-- The complete_booking RPC sets completed_at when cleaner marks job done.

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.completed_at IS 'When the cleaner marked the job as complete (set by complete_booking RPC)';
