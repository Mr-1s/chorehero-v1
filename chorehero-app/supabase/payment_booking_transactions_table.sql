-- ============================================================================
-- Payment-Booking Transaction Integrity Table
-- Ensures atomic operations between payments and bookings
-- ============================================================================

-- Create payment_booking_transactions table
CREATE TABLE IF NOT EXISTS public.payment_booking_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    cleaner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
    payment_intent_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'rolled_back'
    )),
    error_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_booking_transactions_customer 
ON public.payment_booking_transactions(customer_id);

CREATE INDEX IF NOT EXISTS idx_payment_booking_transactions_cleaner
ON public.payment_booking_transactions(cleaner_id);

CREATE INDEX IF NOT EXISTS idx_payment_booking_transactions_status
ON public.payment_booking_transactions(status);

CREATE INDEX IF NOT EXISTS idx_payment_booking_transactions_payment_intent
ON public.payment_booking_transactions(payment_intent_id);

-- Create index for finding incomplete transactions (for cleanup jobs)
CREATE INDEX IF NOT EXISTS idx_payment_booking_transactions_incomplete
ON public.payment_booking_transactions(created_at)
WHERE status IN ('pending', 'processing');

-- Enable RLS
ALTER TABLE public.payment_booking_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own transactions" ON public.payment_booking_transactions
  FOR SELECT USING (
    customer_id = auth.uid() OR cleaner_id = auth.uid()
  );

CREATE POLICY "System can manage all transactions" ON public.payment_booking_transactions
  FOR ALL USING (
    -- Allow service role to manage all transactions
    auth.role() = 'service_role'
  );

-- Update trigger
CREATE OR REPLACE FUNCTION update_payment_booking_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER payment_booking_transactions_updated_at
    BEFORE UPDATE ON public.payment_booking_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_booking_transactions_updated_at();

-- Function to clean up stale transactions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_stale_transactions()
RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER := 0;
BEGIN
    -- Mark transactions as failed if they've been pending for more than 30 minutes
    UPDATE public.payment_booking_transactions
    SET status = 'failed',
        error_reason = 'Transaction timed out',
        updated_at = NOW()
    WHERE status IN ('pending', 'processing')
      AND created_at < NOW() - INTERVAL '30 minutes';
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    
    RETURN cleaned_count;
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE public.payment_booking_transactions IS 'Tracks atomic payment and booking operations to ensure data integrity';
COMMENT ON COLUMN public.payment_booking_transactions.status IS 'Transaction status: pending -> processing -> completed/failed/rolled_back';
COMMENT ON COLUMN public.payment_booking_transactions.payment_intent_id IS 'Stripe payment intent ID for tracking payments';
COMMENT ON COLUMN public.payment_booking_transactions.error_reason IS 'Detailed error message if transaction fails';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Payment-Booking Transaction Integrity table created successfully!';
  RAISE NOTICE '- Added atomic transaction tracking';
  RAISE NOTICE '- Created performance indexes';  
  RAISE NOTICE '- Enabled RLS with proper policies';
  RAISE NOTICE '- Added cleanup function for stale transactions';
END $$;
