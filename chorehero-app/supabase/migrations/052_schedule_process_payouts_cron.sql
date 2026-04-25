-- Migration 052: Schedule process-payouts Edge Function via pg_cron (optional)
--
-- Prerequisites: Enable pg_cron and pg_net in Supabase Dashboard (Database → Extensions).
--
-- After migration: Update cron_config with your project URL and CRON_SECRET:
--   UPDATE cron_config SET value = 'https://YOUR_PROJECT_REF.supabase.co' WHERE key = 'supabase_url';
--   UPDATE cron_config SET value = 'your-cron-secret' WHERE key = 'cron_secret';
--
-- Alternative: Use GitHub Actions workflow (.github/workflows/schedule-process-payouts.yml)
-- which runs hourly without database extensions.

-- Config table for cron (URL and secret)
CREATE TABLE IF NOT EXISTS cron_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default placeholder - user must update with real values
INSERT INTO cron_config (key, value) VALUES
  ('supabase_url', 'https://REPLACE_WITH_YOUR_PROJECT_REF.supabase.co'),
  ('cron_secret', '')
ON CONFLICT (key) DO NOTHING;

-- Function to invoke process-payouts Edge Function
CREATE OR REPLACE FUNCTION invoke_process_payouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url TEXT;
  v_secret TEXT;
  v_headers JSONB;
BEGIN
  SELECT value INTO v_url FROM cron_config WHERE key = 'supabase_url';
  SELECT value INTO v_secret FROM cron_config WHERE key = 'cron_secret';

  IF v_url IS NULL OR v_url LIKE '%REPLACE%' THEN
    RAISE NOTICE 'cron_config.supabase_url not set. Run: UPDATE cron_config SET value = ''https://YOUR_PROJECT.supabase.co'' WHERE key = ''supabase_url'';';
    RETURN;
  END IF;

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_secret IS NOT NULL AND v_secret != '' THEN
    v_headers := v_headers || jsonb_build_object('Authorization', 'Bearer ' || v_secret);
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/process-payouts',
    headers := v_headers,
    body := '{}'::jsonb
  );
END;
$$;

-- Schedule hourly (requires pg_cron extension)
-- Uncomment after enabling pg_cron in Dashboard:
/*
SELECT cron.schedule(
  'process-payouts-hourly',
  '0 * * * *',
  'SELECT invoke_process_payouts()'
);
*/

COMMENT ON TABLE cron_config IS 'Config for pg_cron jobs. Update supabase_url and cron_secret before enabling process-payouts cron.';
COMMENT ON FUNCTION invoke_process_payouts() IS 'Invokes process-payouts Edge Function. Used by pg_cron or can be called manually.';
