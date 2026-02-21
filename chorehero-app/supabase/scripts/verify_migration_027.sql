-- Pre-migration 027 verification (run in Supabase SQL Editor before applying 027)
-- Run in transaction, then ROLLBACK. Only COMMIT if you intend to keep changes.

BEGIN;

-- 1. Verify payout_queue exists
SELECT 1 FROM payout_queue LIMIT 1;

-- 2. Verify flagged_messages exists (from 026)
SELECT 1 FROM flagged_messages LIMIT 1;

-- 3. Verify RPCs exist
SELECT proname FROM pg_proc
WHERE proname IN ('complete_booking', 'get_ranked_cleaner_feed', 'enqueue_cleaner_payout')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

ROLLBACK;
