-- Add missing columns to bookings table for the new booking flow
-- Run this in Supabase SQL Editor

-- Address and location details
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS address TEXT;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS apartment_unit TEXT;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS access_instructions TEXT;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS special_requests TEXT;

-- Custom booking answers (for cleaner-specific questions)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS custom_answers JSONB DEFAULT '{}';

-- Recurring booking support
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS recurring_frequency TEXT;

-- Payment tracking
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Service details
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS service_type TEXT;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER DEFAULT 120;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS total_price NUMERIC DEFAULT 0;

-- Timestamps
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;
