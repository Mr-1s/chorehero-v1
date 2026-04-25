-- Migration 049: Notify pros when a new video quote job is created
-- Finds top 5 nearest cleaners and inserts notifications

-- ============================================================
-- 1. find_pros_for_quote_job: Returns cleaner user_ids for a job
--    Uses job lat/lng or address_id; limits to 5 nearest
-- ============================================================
CREATE OR REPLACE FUNCTION find_pros_for_quote_job(p_job_id UUID)
RETURNS TABLE (user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lat FLOAT;
  v_lng FLOAT;
  v_category TEXT;
BEGIN
  -- Get job coordinates: prefer job.latitude/longitude, fallback to address_id
  SELECT
    COALESCE(j.latitude::float, a.latitude::float),
    COALESCE(j.longitude::float, a.longitude::float),
    j.category::text
  INTO v_lat, v_lng, v_category
  FROM public.jobs j
  LEFT JOIN public.addresses a ON j.address_id = a.id
  WHERE j.id = p_job_id;

  -- If no coords, return all available cleaners (no distance filter)
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN QUERY
    SELECT cp.user_id
    FROM public.cleaner_profiles cp
    JOIN public.users u ON u.id = cp.user_id AND u.role = 'cleaner'
    WHERE cp.is_available = true
      AND (cp.verification_status::text IN ('verified', 'pending') OR cp.verification_status IS NULL)
    LIMIT 5;
    RETURN;
  END IF;

  -- Use find_cleaners_for_job with 50km radius, limit to 5
  RETURN QUERY
  SELECT find_cleaners_for_job.user_id
  FROM find_cleaners_for_job(v_lat, v_lng, v_category, 50)
  LIMIT 5;
END;
$$;

-- ============================================================
-- 2. notify_pros_new_quote_job: Trigger on jobs INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION notify_pros_new_quote_job()
RETURNS TRIGGER AS $$
DECLARE
  v_pro_id UUID;
  v_category_label TEXT;
  v_total INTEGER;
BEGIN
  v_category_label := INITCAP(REPLACE(NEW.category::text, '_', ' '));
  v_total := 0;

  FOR v_pro_id IN SELECT find_pros_for_quote_job.user_id FROM find_pros_for_quote_job(NEW.id)
  LOOP
    v_total := v_total + 1;
    INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_pro_id,
      'quote_job',
      'New ' || v_category_label || ' job nearby',
      'A customer needs help. Send a video quote to get booked.',
      jsonb_build_object(
        'type', 'new_quote_job',
        'job_id', NEW.id,
        'category', NEW.category,
        'headline', NEW.headline
      ),
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_job_insert_notify_pros ON public.jobs;
CREATE TRIGGER on_job_insert_notify_pros
  AFTER INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION notify_pros_new_quote_job();
