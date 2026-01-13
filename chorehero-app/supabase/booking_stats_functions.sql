-- ChoreHero Booking Stats Functions
-- Run this in Supabase SQL Editor to enable real-time stats updates

-- Function to increment cleaner bookings and update earnings
CREATE OR REPLACE FUNCTION increment_cleaner_bookings(
  cleaner_user_id UUID,
  booking_amount NUMERIC DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update cleaner_profiles with new booking
  UPDATE cleaner_profiles
  SET 
    total_jobs = COALESCE(total_jobs, 0) + 1,
    total_earnings = COALESCE(total_earnings, 0) + booking_amount,
    updated_at = NOW()
  WHERE user_id = cleaner_user_id;
  
  -- If no row was updated, the cleaner might not have a profile yet
  IF NOT FOUND THEN
    INSERT INTO cleaner_profiles (user_id, total_jobs, total_earnings, updated_at)
    VALUES (cleaner_user_id, 1, booking_amount, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_jobs = COALESCE(cleaner_profiles.total_jobs, 0) + 1,
      total_earnings = COALESCE(cleaner_profiles.total_earnings, 0) + booking_amount,
      updated_at = NOW();
  END IF;
END;
$$;

-- Function to update cleaner rating after a review
CREATE OR REPLACE FUNCTION update_cleaner_rating(
  cleaner_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  avg_rating NUMERIC;
  review_count INTEGER;
BEGIN
  -- Calculate average rating from reviews
  SELECT 
    AVG(rating)::NUMERIC(3,2),
    COUNT(*)
  INTO avg_rating, review_count
  FROM reviews
  WHERE cleaner_id = cleaner_user_id;
  
  -- Update cleaner_profiles with new rating
  UPDATE cleaner_profiles
  SET 
    rating_average = COALESCE(avg_rating, 0),
    total_reviews = review_count,
    updated_at = NOW()
  WHERE user_id = cleaner_user_id;
END;
$$;

-- Function to mark booking as completed and update earnings
CREATE OR REPLACE FUNCTION complete_booking(
  booking_uuid UUID,
  final_amount NUMERIC DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaner_id UUID;
  v_amount NUMERIC;
BEGIN
  -- Get booking details
  SELECT cleaner_id, COALESCE(final_amount, total_price)
  INTO v_cleaner_id, v_amount
  FROM bookings
  WHERE id = booking_uuid;
  
  -- Update booking status
  UPDATE bookings
  SET 
    status = 'completed',
    completed_at = NOW(),
    payment_status = 'paid',
    updated_at = NOW()
  WHERE id = booking_uuid;
  
  -- The earnings were already added when booking was created
  -- But we could track "confirmed earnings" separately if needed
END;
$$;

-- Add total_earnings column to cleaner_profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaner_profiles' 
    AND column_name = 'total_earnings'
  ) THEN
    ALTER TABLE cleaner_profiles ADD COLUMN total_earnings NUMERIC DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cleaner_profiles' 
    AND column_name = 'total_reviews'
  ) THEN
    ALTER TABLE cleaner_profiles ADD COLUMN total_reviews INTEGER DEFAULT 0;
  END IF;
END $$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_cleaner_bookings TO authenticated;
GRANT EXECUTE ON FUNCTION update_cleaner_rating TO authenticated;
GRANT EXECUTE ON FUNCTION complete_booking TO authenticated;
