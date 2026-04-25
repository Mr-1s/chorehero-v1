-- Backfill payment_status for quote-based bookings created via fake payment flow
-- (QuoteAcceptScreen with USE_FAKE_PAYMENT did not set payment_status, so they defaulted to 'pending')
-- This allows them to appear in the customer's Bookings screen (which filters by payment_status = 'succeeded')

UPDATE public.bookings
SET payment_status = 'succeeded'
WHERE payment_status = 'pending'
  AND quote_id IS NOT NULL;
