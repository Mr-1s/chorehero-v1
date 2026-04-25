-- Migration 064: Fix payout_queue ON CONFLICT - restore full UNIQUE on booking_id
-- Migration 027 replaced the unique constraint with a partial index, which breaks
-- enqueue_cleaner_payout's ON CONFLICT (booking_id) DO NOTHING.
-- Restore full unique so the trigger works.

DROP INDEX IF EXISTS idx_unique_pending_payout;

-- Ensure one row per booking in payout_queue (idempotent enqueue)
ALTER TABLE payout_queue DROP CONSTRAINT IF EXISTS payout_queue_booking_id_key;
ALTER TABLE payout_queue ADD CONSTRAINT payout_queue_booking_id_key UNIQUE (booking_id);
