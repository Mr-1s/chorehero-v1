-- Migration 050: Notify customer when a pro sends a video quote

CREATE OR REPLACE FUNCTION notify_customer_new_quote()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_pro_name TEXT;
  v_price_cents INTEGER;
BEGIN
  -- Get customer and pro name from job and users
  SELECT j.customer_id INTO v_customer_id FROM public.jobs j WHERE j.id = NEW.job_id;
  IF v_customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.name INTO v_pro_name FROM public.users u WHERE u.id = NEW.pro_id;
  v_pro_name := COALESCE(v_pro_name, 'A pro');
  v_price_cents := NEW.price_cents;

  INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
  VALUES (
    v_customer_id,
    'new_quote',
    'New quote from ' || v_pro_name,
    'You have a new quote: $' || (v_price_cents / 100)::text,
    jsonb_build_object(
      'type', 'new_quote',
      'quote_id', NEW.id,
      'job_id', NEW.job_id,
      'pro_id', NEW.pro_id,
      'price_cents', v_price_cents
    ),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_quote_insert_notify_customer ON public.quotes;
CREATE TRIGGER on_quote_insert_notify_customer
  AFTER INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION notify_customer_new_quote();
