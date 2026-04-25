-- Verify Pro Workflow Schema
-- Run in Supabase SQL Editor to confirm required columns exist

-- Bookings: required columns for quote flow and mark complete
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bookings'
  AND column_name IN ('cleaner_id', 'status', 'completed_at', 'cleaner_earnings', 'stripe_payment_intent_id', 'quote_id', 'job_id', 'payment_status')
ORDER BY column_name;

-- payout_queue: required for 48h payout display
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'payout_queue'
ORDER BY ordinal_position;

-- transactions: required for paid payout history
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transactions'
ORDER BY ordinal_position;
