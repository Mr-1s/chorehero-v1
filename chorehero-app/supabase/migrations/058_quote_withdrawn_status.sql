-- Migration 058: Quote withdrawn status and withdrawn_at
-- Pro can withdraw a quote before customer accepts; distinct from declined (customer rejected)

ALTER TYPE quote_status ADD VALUE IF NOT EXISTS 'withdrawn';

ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;

COMMENT ON COLUMN public.quotes.withdrawn_at IS 'When pro withdrew this quote (status=withdrawn). NULL if not withdrawn.';
