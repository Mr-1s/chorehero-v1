-- ============================================================================
-- ChoreHero: Fix Booking Table CASCADE DELETE Issues
-- This migration adds proper cascade deletion and soft deletion support
-- ============================================================================

-- Add soft deletion columns to bookings table
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS customer_deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cleaner_deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Add soft deletion columns to reviews table  
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS customer_deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cleaner_deleted_at TIMESTAMPTZ;

-- Add soft deletion columns to chat_messages table
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS user_deleted_at TIMESTAMPTZ;

-- Add soft deletion columns to chat_rooms table
ALTER TABLE public.chat_rooms
ADD COLUMN IF NOT EXISTS participant1_deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS participant2_deleted_at TIMESTAMPTZ;

-- ============================================================================
-- Update booking constraints to handle user deletion properly
-- ============================================================================

-- Drop existing foreign key constraints on bookings table
ALTER TABLE public.bookings 
DROP CONSTRAINT IF EXISTS bookings_customer_id_fkey,
DROP CONSTRAINT IF EXISTS bookings_cleaner_id_fkey;

-- Re-add constraints with proper CASCADE behavior
-- Customer deletion should set customer_id to NULL and mark deletion time
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.users(id) 
ON DELETE SET NULL;

-- Cleaner deletion should set cleaner_id to NULL and mark deletion time  
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_cleaner_id_fkey
FOREIGN KEY (cleaner_id) REFERENCES public.users(id)
ON DELETE SET NULL;

-- ============================================================================
-- Update review constraints to preserve reviews when users are deleted
-- ============================================================================

-- Drop existing foreign key constraints on reviews table
ALTER TABLE public.reviews
DROP CONSTRAINT IF EXISTS reviews_customer_id_fkey,
DROP CONSTRAINT IF EXISTS reviews_cleaner_id_fkey;

-- Re-add constraints with NULL behavior (preserve reviews for other users)
ALTER TABLE public.reviews
ADD CONSTRAINT reviews_customer_id_fkey
FOREIGN KEY (customer_id) REFERENCES public.users(id)
ON DELETE SET NULL;

ALTER TABLE public.reviews  
ADD CONSTRAINT reviews_cleaner_id_fkey
FOREIGN KEY (cleaner_id) REFERENCES public.users(id)
ON DELETE SET NULL;

-- ============================================================================
-- Create triggers to handle soft deletion timestamps
-- ============================================================================

-- Function to handle booking user deletion
CREATE OR REPLACE FUNCTION handle_booking_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- If customer is being set to NULL, record deletion time
  IF OLD.customer_id IS NOT NULL AND NEW.customer_id IS NULL THEN
    NEW.customer_deleted_at = NOW();
  END IF;
  
  -- If cleaner is being set to NULL, record deletion time
  IF OLD.cleaner_id IS NOT NULL AND NEW.cleaner_id IS NULL THEN
    NEW.cleaner_deleted_at = NOW();
  END IF;
  
  -- If both users are deleted, cancel the booking
  IF NEW.customer_id IS NULL AND NEW.cleaner_id IS NULL THEN
    NEW.status = 'cancelled';
    NEW.cancellation_reason = 'All participants deleted their accounts';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for booking soft deletion
CREATE TRIGGER booking_user_deletion_trigger
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION handle_booking_user_deletion();

-- Function to handle review user deletion
CREATE OR REPLACE FUNCTION handle_review_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- If customer is being set to NULL, record deletion time
  IF OLD.customer_id IS NOT NULL AND NEW.customer_id IS NULL THEN
    NEW.customer_deleted_at = NOW();
  END IF;
  
  -- If cleaner is being set to NULL, record deletion time  
  IF OLD.cleaner_id IS NOT NULL AND NEW.cleaner_id IS NULL THEN
    NEW.cleaner_deleted_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for review soft deletion
CREATE TRIGGER review_user_deletion_trigger
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW  
  EXECUTE FUNCTION handle_review_user_deletion();

-- ============================================================================
-- Create indexes for better performance on soft-deleted data
-- ============================================================================

-- Index for finding non-deleted bookings
CREATE INDEX IF NOT EXISTS idx_bookings_active 
ON public.bookings(customer_id, cleaner_id) 
WHERE customer_deleted_at IS NULL AND cleaner_deleted_at IS NULL;

-- Index for finding non-deleted reviews
CREATE INDEX IF NOT EXISTS idx_reviews_active
ON public.reviews(customer_id, cleaner_id)
WHERE customer_deleted_at IS NULL AND cleaner_deleted_at IS NULL;

-- Index for soft deletion timestamps
CREATE INDEX IF NOT EXISTS idx_bookings_customer_deleted 
ON public.bookings(customer_deleted_at) 
WHERE customer_deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_cleaner_deleted
ON public.bookings(cleaner_deleted_at)
WHERE cleaner_deleted_at IS NOT NULL;

-- ============================================================================
-- Create views for active (non-deleted) data
-- ============================================================================

-- View for active bookings (where users haven't been deleted)
CREATE OR REPLACE VIEW active_bookings AS
SELECT * FROM public.bookings
WHERE customer_deleted_at IS NULL AND cleaner_deleted_at IS NULL;

-- View for active reviews (where users haven't been deleted)  
CREATE OR REPLACE VIEW active_reviews AS
SELECT * FROM public.reviews
WHERE customer_deleted_at IS NULL AND cleaner_deleted_at IS NULL;

-- ============================================================================
-- Update RLS policies to handle soft deletion
-- ============================================================================

-- Drop existing booking policies
DROP POLICY IF EXISTS "Users can view their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can update their bookings" ON public.bookings;

-- Create new policies that respect soft deletion
CREATE POLICY "Users can view their active bookings" ON public.bookings
  FOR SELECT USING (
    (customer_id = auth.uid() AND customer_deleted_at IS NULL) OR
    (cleaner_id = auth.uid() AND cleaner_deleted_at IS NULL)
  );

CREATE POLICY "Users can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (
    customer_id = auth.uid() OR cleaner_id = auth.uid()
  );

CREATE POLICY "Users can update their active bookings" ON public.bookings
  FOR UPDATE USING (
    (customer_id = auth.uid() AND customer_deleted_at IS NULL) OR
    (cleaner_id = auth.uid() AND cleaner_deleted_at IS NULL)
  );

-- Drop existing review policies  
DROP POLICY IF EXISTS "Users can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can create reviews" ON public.reviews;

-- Create new review policies that respect soft deletion
CREATE POLICY "Users can view active reviews" ON public.reviews
  FOR SELECT USING (
    customer_deleted_at IS NULL AND cleaner_deleted_at IS NULL
  );

CREATE POLICY "Users can create reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
  );

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN public.bookings.customer_deleted_at IS 'Timestamp when customer account was deleted';
COMMENT ON COLUMN public.bookings.cleaner_deleted_at IS 'Timestamp when cleaner account was deleted';
COMMENT ON COLUMN public.bookings.cancellation_reason IS 'Reason for booking cancellation';

COMMENT ON COLUMN public.reviews.customer_deleted_at IS 'Timestamp when customer account was deleted';
COMMENT ON COLUMN public.reviews.cleaner_deleted_at IS 'Timestamp when cleaner account was deleted';

COMMENT ON VIEW active_bookings IS 'View of bookings where no participants have deleted their accounts';
COMMENT ON VIEW active_reviews IS 'View of reviews where no participants have deleted their accounts';

-- ============================================================================
-- Success message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'ChoreHero CASCADE DELETE fixes applied successfully!';
  RAISE NOTICE '- Added soft deletion columns to bookings and reviews';
  RAISE NOTICE '- Updated foreign key constraints to SET NULL on deletion';
  RAISE NOTICE '- Created triggers to handle deletion timestamps';
  RAISE NOTICE '- Added performance indexes for soft-deleted data';
  RAISE NOTICE '- Created views for active (non-deleted) data';
  RAISE NOTICE '- Updated RLS policies to respect soft deletion';
END $$;
