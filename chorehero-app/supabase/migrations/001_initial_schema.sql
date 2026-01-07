-- Initial migration for ChoreHero database
-- Run this file to set up the complete database schema

-- Import the main schema
\i schema.sql

-- Import RLS policies
\i rls_policies.sql

-- Insert default service types
INSERT INTO public.services (type, name, description, base_price, estimated_duration, included_tasks) VALUES
('express', 'Express Clean', 'Quick 30-45 minute cleaning for maintenance', 45.00, 35, ARRAY[
  'Bathroom cleaning',
  'Kitchen surfaces', 
  'Vacuum main areas',
  'Trash removal'
]),
('standard', 'Standard Clean', 'Comprehensive cleaning for regular maintenance', 75.00, 90, ARRAY[
  'All Express Clean tasks',
  'Bedroom cleaning',
  'Dusting surfaces',
  'Mop floors',
  'Light organizing'
]),
('deep', 'Deep Clean', 'Thorough cleaning for move-in/out or special occasions', 150.00, 180, ARRAY[
  'All Standard Clean tasks',
  'Inside appliances',
  'Baseboards & windowsills', 
  'Interior windows',
  'Detailed organization'
]);

-- Insert default add-ons
INSERT INTO public.add_ons (name, description, price, estimated_time_minutes, category) VALUES
('Inside Fridge', 'Clean inside of refrigerator', 15.00, 15, 'cleaning'),
('Inside Oven', 'Clean inside of oven', 20.00, 20, 'cleaning'),
('Laundry Folding', 'Fold and organize clean laundry', 25.00, 30, 'organization'),
('Inside Cabinets', 'Clean inside kitchen cabinets', 30.00, 45, 'cleaning'),
('Garage Organization', 'Organize garage space', 50.00, 60, 'organization'),
('Window Cleaning (Interior)', 'Clean interior windows', 20.00, 25, 'cleaning'),
('Refrigerator Organization', 'Organize refrigerator contents', 15.00, 20, 'organization'),
('Closet Organization', 'Organize bedroom closets', 35.00, 45, 'organization');

-- Create function to calculate booking totals
CREATE OR REPLACE FUNCTION calculate_booking_total(
  service_base_price DECIMAL,
  add_ons_total DECIMAL,
  tip_amount DECIMAL DEFAULT 0
)
RETURNS TABLE(
  platform_fee DECIMAL,
  tax DECIMAL,
  total_amount DECIMAL,
  cleaner_earnings DECIMAL
) AS $$
DECLARE
  subtotal DECIMAL;
  calculated_platform_fee DECIMAL;
  calculated_tax DECIMAL;
  calculated_total DECIMAL;
  calculated_cleaner_earnings DECIMAL;
BEGIN
  subtotal := service_base_price + add_ons_total;
  calculated_platform_fee := subtotal * 0.25; -- 25% platform fee
  calculated_tax := subtotal * 0.08; -- 8% tax (simplified)
  calculated_total := subtotal + calculated_platform_fee + calculated_tax + tip_amount;
  calculated_cleaner_earnings := subtotal * 0.70 + tip_amount; -- 70% to cleaner + tips
  
  RETURN QUERY SELECT 
    calculated_platform_fee,
    calculated_tax,
    calculated_total,
    calculated_cleaner_earnings;
END;
$$ LANGUAGE plpgsql;

-- Function to find available cleaners
CREATE OR REPLACE FUNCTION find_available_cleaners(
  customer_lat DECIMAL,
  customer_lng DECIMAL,
  service_time TIMESTAMP WITH TIME ZONE,
  radius_km INTEGER DEFAULT 25
)
RETURNS TABLE(
  cleaner_id UUID,
  name VARCHAR,
  rating_average DECIMAL,
  hourly_rate DECIMAL,
  distance_km DECIMAL,
  video_profile_url TEXT,
  specialties TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.name,
    cp.rating_average,
    cp.hourly_rate,
    calculate_distance_km(customer_lat, customer_lng, a.latitude, a.longitude) as distance_km,
    cp.video_profile_url,
    cp.specialties
  FROM public.users u
  JOIN public.cleaner_profiles cp ON u.id = cp.user_id
  JOIN public.addresses a ON u.id = a.user_id AND a.is_default = true
  WHERE u.role = 'cleaner'
    AND cp.verification_status = 'verified'
    AND cp.is_available = true
    AND u.is_active = true
    AND calculate_distance_km(customer_lat, customer_lng, a.latitude, a.longitude) <= radius_km
    -- Check availability for the requested time
    AND EXISTS (
      SELECT 1 FROM public.cleaner_availability ca
      WHERE ca.cleaner_id = u.id
        AND ca.day_of_week = EXTRACT(DOW FROM service_time)
        AND ca.start_time <= service_time::TIME
        AND ca.end_time >= service_time::TIME
        AND ca.is_available = true
    )
    -- Check no conflicting bookings
    AND NOT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.cleaner_id = u.id
        AND b.status IN ('confirmed', 'cleaner_assigned', 'cleaner_en_route', 'cleaner_arrived', 'in_progress')
        AND b.scheduled_time <= service_time + INTERVAL '3 hours'
        AND b.scheduled_time + INTERVAL '1 hour' * b.estimated_duration / 60 >= service_time
    )
  ORDER BY distance_km ASC, cp.rating_average DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to update user ratings
CREATE OR REPLACE FUNCTION update_user_rating(user_uuid UUID)
RETURNS VOID AS $$
DECLARE
  avg_rating DECIMAL;
  rating_count INTEGER;
BEGIN
  SELECT 
    COALESCE(AVG(rating), 0)::DECIMAL(3,2),
    COUNT(*)
  INTO avg_rating, rating_count
  FROM public.ratings 
  WHERE rated_id = user_uuid AND is_visible = true;
  
  -- Update cleaner profile if user is a cleaner
  UPDATE public.cleaner_profiles 
  SET 
    rating_average = avg_rating,
    rating_count = rating_count,
    updated_at = NOW()
  WHERE user_id = user_uuid;
  
  -- Update customer profile if user is a customer
  UPDATE public.customer_profiles 
  SET 
    average_rating = avg_rating,
    updated_at = NOW()
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update ratings when a new rating is added
CREATE OR REPLACE FUNCTION trigger_update_rating()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_user_rating(NEW.rated_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_rating_insert
  AFTER INSERT ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rating();

CREATE TRIGGER after_rating_update
  AFTER UPDATE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_rating();

-- Function to handle booking completion
CREATE OR REPLACE FUNCTION complete_booking(booking_uuid UUID)
RETURNS VOID AS $$
DECLARE
  booking_record RECORD;
BEGIN
  -- Get booking details
  SELECT * INTO booking_record FROM public.bookings WHERE id = booking_uuid;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;
  
  -- Update booking status
  UPDATE public.bookings 
  SET 
    status = 'completed',
    actual_end_time = NOW(),
    updated_at = NOW()
  WHERE id = booking_uuid;
  
  -- Update cleaner stats
  UPDATE public.cleaner_profiles 
  SET 
    total_jobs = total_jobs + 1,
    total_earnings = total_earnings + booking_record.cleaner_earnings,
    updated_at = NOW()
  WHERE user_id = booking_record.cleaner_id;
  
  -- Update customer stats
  UPDATE public.customer_profiles 
  SET 
    total_bookings = total_bookings + 1,
    total_spent = total_spent + booking_record.total_amount,
    updated_at = NOW()
  WHERE user_id = booking_record.customer_id;
END;
$$ LANGUAGE plpgsql;

-- Create real-time subscription channels
-- Enable real-time for booking updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_updates;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;