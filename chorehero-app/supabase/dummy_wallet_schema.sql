-- Dummy Wallet System for ChoreHero Testing
-- Run this in Supabase SQL Editor to set up wallet testing

-- ============================================================================
-- DUMMY WALLETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dummy_wallets (
    user_id UUID PRIMARY KEY,
    customer_balance INTEGER DEFAULT 0, -- Balance in cents
    cleaner_balance INTEGER DEFAULT 0,  -- Balance in cents
    platform_balance INTEGER DEFAULT 0, -- Platform earnings in cents
    total_spent INTEGER DEFAULT 0,      -- Lifetime spending in cents
    total_earned INTEGER DEFAULT 0,     -- Lifetime earnings in cents
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dummy_wallets_user_id ON public.dummy_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_dummy_wallets_balances ON public.dummy_wallets(customer_balance, cleaner_balance);

-- ============================================================================
-- DUMMY TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dummy_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('payment', 'payout', 'refund', 'tip')),
    amount INTEGER NOT NULL, -- Amount in cents
    description TEXT NOT NULL,
    booking_id UUID,
    cleaner_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dummy_transactions_user_id ON public.dummy_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_dummy_transactions_booking_id ON public.dummy_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_dummy_transactions_created_at ON public.dummy_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dummy_transactions_type ON public.dummy_transactions(type);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.dummy_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dummy_transactions ENABLE ROW LEVEL SECURITY;

-- Wallet policies - users can only see their own wallet
CREATE POLICY "Users can view their own wallet" ON public.dummy_wallets
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own wallet" ON public.dummy_wallets
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Service can insert wallets" ON public.dummy_wallets
    FOR INSERT WITH CHECK (true);

-- Transaction policies - users can only see their own transactions
CREATE POLICY "Users can view their own transactions" ON public.dummy_transactions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service can insert transactions" ON public.dummy_transactions
    FOR INSERT WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get platform analytics
CREATE OR REPLACE FUNCTION get_platform_analytics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_revenue', COALESCE(SUM(platform_balance), 0),
        'total_payouts', COALESCE(SUM(total_earned), 0),
        'active_users', COUNT(DISTINCT user_id),
        'transaction_volume', (
            SELECT COALESCE(SUM(amount), 0) 
            FROM public.dummy_transactions 
            WHERE status = 'completed'
        )
    ) INTO result
    FROM public.dummy_wallets;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize platform wallet
CREATE OR REPLACE FUNCTION initialize_platform_wallet()
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.dummy_wallets (user_id, customer_balance, cleaner_balance, platform_balance)
    VALUES ('00000000-0000-0000-0000-000000000000', 0, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dummy_wallets_updated_at 
    BEFORE UPDATE ON public.dummy_wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- Initialize platform wallet
SELECT initialize_platform_wallet();

-- Grant permissions
GRANT ALL ON public.dummy_wallets TO authenticated;
GRANT ALL ON public.dummy_transactions TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_analytics() TO authenticated;

-- ============================================================================
-- TESTING DATA (OPTIONAL)
-- ============================================================================

-- Uncomment to add test data
/*
-- Add test customer wallet with initial balance
INSERT INTO public.dummy_wallets (user_id, customer_balance, cleaner_balance, platform_balance, total_spent, total_earned)
VALUES 
    ('test-customer-1', 50000, 0, 0, 0, 0), -- $500 initial balance
    ('test-cleaner-1', 0, 25000, 0, 0, 25000); -- $250 earned

-- Add test transactions
INSERT INTO public.dummy_transactions (user_id, type, amount, description, status)
VALUES 
    ('test-customer-1', 'payment', 50000, 'Initial wallet funding', 'completed'),
    ('test-cleaner-1', 'payment', 8500, 'Kitchen cleaning service', 'completed'),
    ('test-cleaner-1', 'payment', 12000, 'Bathroom deep clean', 'completed'),
    ('test-cleaner-1', 'payment', 4500, 'Tip from customer', 'completed');
*/

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check tables were created successfully
SELECT 
    schemaname, 
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('dummy_wallets', 'dummy_transactions')
ORDER BY tablename;

-- Check functions were created
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('get_platform_analytics', 'initialize_platform_wallet');

-- Show success message
SELECT 'Dummy Wallet System setup completed successfully! 🎉' as result;
