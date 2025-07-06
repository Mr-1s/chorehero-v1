-- Row Level Security Policies for ChoreHero
-- Enable RLS on all tables

-- Users table policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view public cleaner profiles" ON public.users
  FOR SELECT USING (role = 'cleaner');

-- Customer profiles policies
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own profile" ON public.customer_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Cleaner profiles policies
ALTER TABLE public.cleaner_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cleaners can manage their own profile" ON public.cleaner_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view verified cleaner profiles" ON public.cleaner_profiles
  FOR SELECT USING (verification_status = 'verified');

-- Addresses policies
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own addresses" ON public.addresses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Cleaners can view booking addresses" ON public.addresses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.address_id = addresses.id 
      AND b.cleaner_id = auth.uid()
    )
  );

-- Payment methods policies
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own payment methods" ON public.payment_methods
  FOR ALL USING (auth.uid() = user_id);

-- Services policies (public read)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active services" ON public.services
  FOR SELECT USING (is_active = true);

-- Add-ons policies (public read)
ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active add-ons" ON public.add_ons
  FOR SELECT USING (is_active = true);

-- Bookings policies
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Cleaners can view their assigned bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = cleaner_id);

CREATE POLICY "Customers can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = customer_id)
  WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Cleaners can update their assigned bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = cleaner_id)
  WITH CHECK (auth.uid() = cleaner_id);

-- Booking add-ons policies
ALTER TABLE public.booking_add_ons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Booking participants can view add-ons" ON public.booking_add_ons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = booking_id 
      AND (b.customer_id = auth.uid() OR b.cleaner_id = auth.uid())
    )
  );

CREATE POLICY "Customers can manage booking add-ons" ON public.booking_add_ons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = booking_id 
      AND b.customer_id = auth.uid()
    )
  );

-- Cleaner availability policies
ALTER TABLE public.cleaner_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cleaners can manage their own availability" ON public.cleaner_availability
  FOR ALL USING (auth.uid() = cleaner_id);

CREATE POLICY "Everyone can view cleaner availability" ON public.cleaner_availability
  FOR SELECT USING (is_available = true);

-- Location updates policies
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own location updates" ON public.location_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Booking participants can view location updates" ON public.location_updates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = booking_id 
      AND (b.customer_id = auth.uid() OR b.cleaner_id = auth.uid())
    )
  );

-- Chat threads policies
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their chat threads" ON public.chat_threads
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Cleaners can view their chat threads" ON public.chat_threads
  FOR SELECT USING (auth.uid() = cleaner_id);

CREATE POLICY "Booking participants can create chat threads" ON public.chat_threads
  FOR INSERT WITH CHECK (
    auth.uid() = customer_id OR auth.uid() = cleaner_id
  );

CREATE POLICY "Booking participants can update chat threads" ON public.chat_threads
  FOR UPDATE USING (
    auth.uid() = customer_id OR auth.uid() = cleaner_id
  );

-- Chat messages policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Thread participants can view messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_threads ct 
      WHERE ct.id = thread_id 
      AND (ct.customer_id = auth.uid() OR ct.cleaner_id = auth.uid())
    )
  );

CREATE POLICY "Thread participants can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.chat_threads ct 
      WHERE ct.id = thread_id 
      AND (ct.customer_id = auth.uid() OR ct.cleaner_id = auth.uid())
    )
  );

CREATE POLICY "Users can update their own messages" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = sender_id);

-- Ratings policies
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ratings for themselves" ON public.ratings
  FOR SELECT USING (auth.uid() = rated_id);

CREATE POLICY "Users can view public ratings for cleaners" ON public.ratings
  FOR SELECT USING (
    is_visible = true AND
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = rated_id AND u.role = 'cleaner'
    )
  );

CREATE POLICY "Booking participants can create ratings" ON public.ratings
  FOR INSERT WITH CHECK (
    auth.uid() = rater_id AND
    EXISTS (
      SELECT 1 FROM public.bookings b 
      WHERE b.id = booking_id 
      AND (b.customer_id = auth.uid() OR b.cleaner_id = auth.uid())
      AND b.status = 'completed'
    )
  );

CREATE POLICY "Raters can update their own ratings" ON public.ratings
  FOR UPDATE USING (auth.uid() = rater_id);

-- Notifications policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true); -- This will be restricted by the application layer

-- Helper functions for RLS

-- Function to check if user is a cleaner
CREATE OR REPLACE FUNCTION auth.is_cleaner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'cleaner'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is a customer
CREATE OR REPLACE FUNCTION auth.is_customer()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'customer'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is verified cleaner
CREATE OR REPLACE FUNCTION auth.is_verified_cleaner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.cleaner_profiles cp
    JOIN public.users u ON u.id = cp.user_id
    WHERE u.id = auth.uid() 
    AND u.role = 'cleaner' 
    AND cp.verification_status = 'verified'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if booking belongs to user
CREATE OR REPLACE FUNCTION auth.booking_belongs_to_user(booking_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.bookings 
    WHERE id = booking_id 
    AND (customer_id = auth.uid() OR cleaner_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;