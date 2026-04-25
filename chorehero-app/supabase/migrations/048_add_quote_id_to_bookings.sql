-- Migration 048: Add quote_id to bookings for video quote -> booking flow
-- Links a booking to the quote it was created from

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_quote_id ON public.bookings(quote_id);

COMMENT ON COLUMN public.bookings.quote_id IS 'When booking was created from a video quote, links to the accepted quote';
