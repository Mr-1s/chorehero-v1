-- Migration 051: Expire video quote jobs and quotes (run via cron)
-- Schedule with: SELECT cron.schedule('expire-quote-jobs', '0 * * * *', 'SELECT expire_quote_jobs()');
-- (runs hourly; requires pg_cron extension)

CREATE OR REPLACE FUNCTION expire_quote_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
BEGIN
  -- Expire quotes past their expiry time
  UPDATE public.quotes
  SET status = 'expired', updated_at = NOW()
  WHERE expires_at < NOW() AND status NOT IN ('accepted', 'declined', 'expired');

  -- Notify customers whose jobs are about to expire with 0 quotes (before we mark expired)
  FOR v_job IN
    SELECT j.id, j.customer_id, j.headline
    FROM public.jobs j
    WHERE j.expires_at < NOW() AND j.status = 'open'
      AND NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.job_id = j.id)
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_job.customer_id,
      'job_expired_no_quotes',
      'No quotes received',
      'Your job "' || LEFT(v_job.headline, 40) || '" expired. Try reposting with a higher budget or more photos.',
      jsonb_build_object('type', 'job_expired', 'job_id', v_job.id),
      NOW()
    );
  END LOOP;

  -- Expire open jobs past their expiry time
  UPDATE public.jobs
  SET status = 'expired', updated_at = NOW()
  WHERE expires_at < NOW() AND status = 'open';

  RETURN;
END;
$$;

COMMENT ON FUNCTION expire_quote_jobs() IS 'Expires jobs and quotes past their deadline. Notifies customers with 0 quotes. Schedule with pg_cron hourly.';
