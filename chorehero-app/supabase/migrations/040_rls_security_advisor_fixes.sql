-- Migration 040: Enable RLS on tables flagged by Security Advisor
-- Fixes "RLS Disabled in Public" for 14 tables

-- ============================================================================
-- 1. PAYMENT_METHODS - Users manage their own payment methods
-- ============================================================================
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own payment methods" ON public.payment_methods;
CREATE POLICY "Users can manage own payment methods" ON public.payment_methods
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- 2. SERVICES - Platform config, read-only for all
-- ============================================================================
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active services" ON public.services;
CREATE POLICY "Public can view active services" ON public.services
  FOR SELECT USING (is_active = true);

-- Service role can manage (for admin)
DROP POLICY IF EXISTS "Service role can manage services" ON public.services;
CREATE POLICY "Service role can manage services" ON public.services
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 3. ADD_ONS - Platform config, read-only for all
-- ============================================================================
ALTER TABLE public.add_ons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active add-ons" ON public.add_ons;
CREATE POLICY "Public can view active add-ons" ON public.add_ons
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage add-ons" ON public.add_ons;
CREATE POLICY "Service role can manage add-ons" ON public.add_ons
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 4. ACTIVE_LOCATIONS - Zip config, read-only for discovery
-- ============================================================================
ALTER TABLE public.active_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active locations" ON public.active_locations;
CREATE POLICY "Public can view active locations" ON public.active_locations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage active locations" ON public.active_locations;
CREATE POLICY "Service role can manage active locations" ON public.active_locations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 5. WAITLIST_LEADS - Lead capture: anon can insert, service manages
-- ============================================================================
ALTER TABLE public.waitlist_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist_leads;
CREATE POLICY "Anyone can join waitlist" ON public.waitlist_leads
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage waitlist" ON public.waitlist_leads;
CREATE POLICY "Service role can manage waitlist" ON public.waitlist_leads
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 6. PAYOUT_QUEUE - Backend only, service_role/triggers
-- ============================================================================
ALTER TABLE public.payout_queue ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon = no user access
-- Cleaners can view their own payout queue entries
DROP POLICY IF EXISTS "Cleaners can view own payout queue" ON public.payout_queue;
CREATE POLICY "Cleaners can view own payout queue" ON public.payout_queue
  FOR SELECT USING (auth.uid() = cleaner_id);

DROP POLICY IF EXISTS "Service role can manage payout queue" ON public.payout_queue;
CREATE POLICY "Service role can manage payout queue" ON public.payout_queue
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 7. FLAGGED_MESSAGES - Trust & safety, admin/service only
-- ============================================================================
ALTER TABLE public.flagged_messages ENABLE ROW LEVEL SECURITY;

-- No user access; service_role only (via policy)
DROP POLICY IF EXISTS "Service role can manage flagged messages" ON public.flagged_messages;
CREATE POLICY "Service role can manage flagged messages" ON public.flagged_messages
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 8. CRON_LOGS - Monitoring, service_role only
-- ============================================================================
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage cron logs" ON public.cron_logs;
CREATE POLICY "Service role can manage cron logs" ON public.cron_logs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- 9. REVIEWS - If table exists, customer/cleaner access
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can view public reviews" ON public.reviews;
    CREATE POLICY "Users can view public reviews" ON public.reviews
      FOR SELECT USING (is_public = true OR auth.uid() = customer_id OR auth.uid() = cleaner_id);

    DROP POLICY IF EXISTS "Customers can create reviews" ON public.reviews;
    CREATE POLICY "Customers can create reviews" ON public.reviews
      FOR INSERT WITH CHECK (
        auth.uid() = customer_id
        AND EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = booking_id
          AND b.customer_id = auth.uid()
          AND b.status = 'completed'
        )
      );

    DROP POLICY IF EXISTS "Customers can update own reviews" ON public.reviews;
    CREATE POLICY "Customers can update own reviews" ON public.reviews
      FOR UPDATE USING (auth.uid() = customer_id);
  END IF;
END $$;

-- ============================================================================
-- 10. PROVIDER_DISCOVERY_INDEX - Public read for LIVE providers
-- ============================================================================
ALTER TABLE public.provider_discovery_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active providers" ON public.provider_discovery_index;
CREATE POLICY "Public can view active providers" ON public.provider_discovery_index
  FOR SELECT USING (provider_state = 'LIVE');

-- Providers can view own entry
DROP POLICY IF EXISTS "Providers can view own discovery entry" ON public.provider_discovery_index;
CREATE POLICY "Providers can view own discovery entry" ON public.provider_discovery_index
  FOR SELECT USING (auth.uid() = provider_id);

-- Service role can manage (triggers sync)
DROP POLICY IF EXISTS "Service role can manage provider discovery" ON public.provider_discovery_index;
CREATE POLICY "Service role can manage provider discovery" ON public.provider_discovery_index
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
