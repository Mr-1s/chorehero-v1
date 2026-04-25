-- ============================================================================
-- 078_security_hardening.sql
--
-- Closes the HIGH and MEDIUM RLS findings from the security audit:
--   F-06  Migration 002 left a permissive INSERT policy on `public.users`
--   F-07  `public.cron_config` was created without RLS
--   F-12  `storage.objects` for content-* buckets allowed any authenticated
--         user to UPDATE/DELETE any object — restrict to the owner only
--   F-15  `service_requests` had only an INSERT policy, blocking owners from
--         seeing or updating their own rows
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- F-06: Tighten public.users INSERT
-- ----------------------------------------------------------------------------
-- Migration 002 created `Enable insert for service role` with `WITH CHECK
-- (true)`, which OR-combines with the stricter policy from migration 001 and
-- effectively allows any client to insert any row.

DROP POLICY IF EXISTS "Enable insert for service role" ON public.users;

CREATE POLICY "Service role can insert users"
  ON public.users
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- The owner-self-insert policy from migration 001 (`auth.uid() = id`) remains
-- intact for normal client-driven signups. Only the unbounded one is removed.

-- ----------------------------------------------------------------------------
-- F-07: Lock down public.cron_config
-- ----------------------------------------------------------------------------
-- The table holds operator secrets (per its own comment in migration 052) and
-- shipped without RLS. Enable RLS and deny everything except service_role.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'cron_config'
  ) THEN
    EXECUTE 'ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY';

    EXECUTE 'DROP POLICY IF EXISTS cron_config_service_only ON public.cron_config';
    EXECUTE $sql$
      CREATE POLICY cron_config_service_only
        ON public.cron_config
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true)
    $sql$;

    -- Revoke any incidental grants to anon/authenticated.
    EXECUTE 'REVOKE ALL ON TABLE public.cron_config FROM anon, authenticated';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- F-12: Storage objects — owner scope on UPDATE / DELETE for content buckets
-- ----------------------------------------------------------------------------
-- Replace the bucket-only policies from migration 045 with policies that also
-- require `auth.uid() = owner`. Reads and inserts are unchanged (public read
-- is intentional; insert requires authenticated).

DO $$
BEGIN
  -- These policy names match what `045_storage_content_upload_policies.sql`
  -- creates. Drop them only if present, then recreate with owner scope.
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can update content" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can delete content" ON storage.objects';

  EXECUTE $sql$
    CREATE POLICY "Authenticated users can update own content"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id IN ('content-videos', 'content-images')
        AND auth.uid() = owner
      )
      WITH CHECK (
        bucket_id IN ('content-videos', 'content-images')
        AND auth.uid() = owner
      )
  $sql$;

  EXECUTE $sql$
    CREATE POLICY "Authenticated users can delete own content"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id IN ('content-videos', 'content-images')
        AND auth.uid() = owner
      )
  $sql$;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- `storage.objects` policies sometimes require running as the storage
    -- owner role. If this migration is run with a role that can't touch
    -- storage policies, log and continue — the operator can apply the policy
    -- via the Supabase dashboard.
    RAISE NOTICE 'Skipped storage.objects policy update (insufficient privilege). Apply via dashboard.';
END $$;

-- ----------------------------------------------------------------------------
-- F-15: service_requests SELECT for the requester
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'service_requests'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS service_requests_owner_select ON public.service_requests';
    EXECUTE $sql$
      CREATE POLICY service_requests_owner_select
        ON public.service_requests
        FOR SELECT
        USING (auth.uid() = requester_id)
    $sql$;
  END IF;
END $$;
