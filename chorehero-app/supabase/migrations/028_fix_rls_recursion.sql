-- Migration 028: Fix infinite recursion in RLS policies
-- Cycles: bookings<->users, bookings<->addresses, bookings<->profiles
-- Fix: Use SECURITY DEFINER functions to bypass RLS when checking cross-table conditions

-- 1. Helper: is current user an active cleaner? (bypasses RLS on users)
CREATE OR REPLACE FUNCTION public.is_cleaner(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND role = 'cleaner' AND is_active = true
  );
$$;

-- 2. Helper: do these two users share a booking? (bypasses RLS on bookings)
CREATE OR REPLACE FUNCTION public.booking_parties_can_see_each_other(p_uid UUID, p_other_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE (b.customer_id = p_uid AND b.cleaner_id = p_other_id)
       OR (b.cleaner_id = p_uid AND b.customer_id = p_other_id)
  );
$$;

-- 3. Helper: does cleaner have a booking at this address? (bypasses RLS on bookings)
CREATE OR REPLACE FUNCTION public.cleaner_has_booking_at_address(p_cleaner_id UUID, p_address_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE address_id = p_address_id AND cleaner_id = p_cleaner_id
  );
$$;

-- 4. Helper: does cleaner have a booking with this customer? (bypasses RLS on bookings)
CREATE OR REPLACE FUNCTION public.cleaner_has_booking_with_customer(p_cleaner_id UUID, p_customer_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE customer_id = p_customer_id AND cleaner_id = p_cleaner_id
  );
$$;

-- 5. Helper: does customer have a booking with this cleaner? (bypasses RLS on bookings)
CREATE OR REPLACE FUNCTION public.customer_has_booking_with_cleaner(p_customer_id UUID, p_cleaner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE customer_id = p_customer_id AND cleaner_id = p_cleaner_id
  );
$$;

-- 6. Replace "Cleaners can view available bookings" - use is_cleaner() instead of subquery
DROP POLICY IF EXISTS "Cleaners can view available bookings" ON public.bookings;
CREATE POLICY "Cleaners can view available bookings" ON public.bookings
  FOR SELECT USING (
    cleaner_id IS NULL
    AND status IN ('pending', 'confirmed')
    AND public.is_cleaner(auth.uid())
  );

-- 7. Replace "booking_parties_see_each_other" on users - use helper instead of subquery
DROP POLICY IF EXISTS "booking_parties_see_each_other" ON public.users;
CREATE POLICY "booking_parties_see_each_other" ON public.users
  FOR SELECT USING (public.booking_parties_can_see_each_other(auth.uid(), id));

-- 8. Replace "Cleaners can view booking addresses" - use helper (breaks bookings->addresses->bookings cycle)
DROP POLICY IF EXISTS "Cleaners can view booking addresses" ON public.addresses;
CREATE POLICY "Cleaners can view booking addresses" ON public.addresses
  FOR SELECT USING (public.cleaner_has_booking_at_address(auth.uid(), id));

-- 9. Replace "Cleaners can view customer profiles for bookings" - use helper
DROP POLICY IF EXISTS "Cleaners can view customer profiles for bookings" ON public.customer_profiles;
CREATE POLICY "Cleaners can view customer profiles for bookings" ON public.customer_profiles
  FOR SELECT USING (public.cleaner_has_booking_with_customer(auth.uid(), user_id));

-- 10. Replace "Customers can view cleaner profiles for bookings" - use helper
DROP POLICY IF EXISTS "Customers can view cleaner profiles for bookings" ON public.cleaner_profiles;
CREATE POLICY "Customers can view cleaner profiles for bookings" ON public.cleaner_profiles
  FOR SELECT USING (public.customer_has_booking_with_cleaner(auth.uid(), user_id));
