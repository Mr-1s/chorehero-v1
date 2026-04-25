-- ============================================================================
-- RLS audit for ChoreHero Supabase project.
--
-- Run this in the Supabase SQL editor (or via psql) and capture the output
-- into RLS_REPORT.md. Do NOT commit the raw output if it contains sensitive
-- policy expressions for internal-only tables.
--
-- This script does not modify policies. It only reports on the current state.
-- ============================================================================

-- 1) Tables in `public` and whether RLS is enabled.
SELECT
  c.relname                           AS table_name,
  c.relrowsecurity                    AS rls_enabled,
  c.relforcerowsecurity               AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'                 -- ordinary tables only
ORDER BY c.relname;

-- 2) Every policy on `public.*` tables, with the qual / with_check expressions.
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3) Tables with NO policies (but RLS may be enabled — those tables are
--    effectively read-only / write-blocked for everyone except service role).
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = c.relname
  )
ORDER BY c.relname;

-- 4) Tables WITHOUT RLS enabled — these are the highest-risk findings.
SELECT
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;

-- 5) Policies whose `qual` or `with_check` does NOT mention `auth.uid()` or
--    `auth.role()` — flag for manual review (some are legitimate, e.g.
--    SELECT-only public catalogs like `services`).
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual IS NULL OR qual NOT LIKE '%auth.%')
  AND (with_check IS NULL OR with_check NOT LIKE '%auth.%')
ORDER BY tablename, policyname;
