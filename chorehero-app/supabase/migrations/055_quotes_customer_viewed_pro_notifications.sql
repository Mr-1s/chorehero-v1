-- Migration 055: quotes.customer_viewed_at + pro notifications for quote status changes
-- Enables "Viewed" status when customer opens job details with video quote

-- 1. Add customer_viewed_at to quotes
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_quotes_customer_viewed ON public.quotes(customer_viewed_at) WHERE customer_viewed_at IS NOT NULL;

COMMENT ON COLUMN public.quotes.customer_viewed_at IS 'When customer first viewed this quote (opened job details with video). Used for pro "Viewed" status.';

-- 2. Function to notify pro when customer views their quote
CREATE OR REPLACE FUNCTION notify_pro_quote_viewed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_viewed_at IS NOT NULL AND (OLD.customer_viewed_at IS NULL OR OLD.customer_viewed_at IS DISTINCT FROM NEW.customer_viewed_at) THEN
    INSERT INTO public.notifications (user_id, type, title, message, data, is_read, created_at)
    VALUES (
      NEW.pro_id,
      'quote_viewed',
      'Customer watched your quote',
      'A customer viewed your video quote.',
      jsonb_build_object('quote_id', NEW.id, 'job_id', NEW.job_id),
      false,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_quote_viewed_notify_pro ON public.quotes;
CREATE TRIGGER on_quote_viewed_notify_pro
  AFTER UPDATE OF customer_viewed_at ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION notify_pro_quote_viewed();

-- 3. Function to notify pro when quote is accepted (called from confirm-quote-payment; backup via trigger)
CREATE OR REPLACE FUNCTION notify_pro_quote_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.notifications (user_id, type, title, message, data, is_read, created_at)
    VALUES (
      NEW.pro_id,
      'quote_accepted',
      'Quote accepted!',
      'Your video quote was accepted. Job booked.',
      jsonb_build_object('quote_id', NEW.id, 'job_id', NEW.job_id),
      false,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_quote_accepted_notify_pro ON public.quotes;
CREATE TRIGGER on_quote_accepted_notify_pro
  AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW
  WHEN (NEW.status = 'accepted')
  EXECUTE FUNCTION notify_pro_quote_accepted();

-- 4. Function to notify pro when customer declines their quote
CREATE OR REPLACE FUNCTION notify_pro_quote_declined()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'declined' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'declined') THEN
    INSERT INTO public.notifications (user_id, type, title, message, data, is_read, created_at)
    VALUES (
      NEW.pro_id,
      'quote_declined',
      'Customer chose another pro',
      'The customer selected a different pro for this job.',
      jsonb_build_object('quote_id', NEW.id, 'job_id', NEW.job_id),
      false,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_quote_declined_notify_pro ON public.quotes;
CREATE TRIGGER on_quote_declined_notify_pro
  AFTER UPDATE OF status ON public.quotes
  FOR EACH ROW
  WHEN (NEW.status = 'declined')
  EXECUTE FUNCTION notify_pro_quote_declined();
