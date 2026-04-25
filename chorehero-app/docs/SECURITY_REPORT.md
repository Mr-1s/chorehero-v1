# ChoreHero Security Report

> Living document. Re-run the security audit after every release that touches edge functions, RLS, or client environment handling.

## Status

Last full audit: covered RLS coverage, Edge Functions auth, storage policies, client env exposure, auth flows, dependency surface, phone uniqueness / account takeover, and Stripe security. Findings were classified HIGH / MEDIUM / LOW.

| Severity | Total | Fixed in this release | Remaining |
|---|---|---|---|
| HIGH | 10 | 9 | F-11 (jobs RLS scope — product decision) |
| MEDIUM | 14 | 6 | 8 (deferred — see "Deferred" below) |
| LOW | 7 | 0 | 7 (advisory only) |

## Fixed in this release

| ID | Title | Fix |
|---|---|---|
| F-01 | `create-quote-payment-intent` had no JWT, used service role | Re-enabled JWT, verified caller == job.customer_id |
| F-02 | `confirm-quote-payment` weak PI binding, `verify_jwt = false` | JWT required; PI metadata customer_id + amount checked; ownership enforced |
| F-03 | `process-refund` accepted arbitrary refunds | JWT required; verify caller owns booking; PI must match booking; refund capped at `bookings.total_amount` |
| F-04 | `send-push` IDOR — anyone could push to anyone | JWT now required; recipient forced to caller unless `INTERNAL_SHARED_SECRET` header is presented (for trusted server fan-out) |
| F-05 | `notify-founder-sms` unauthenticated | Requires JWT or `INTERNAL_SHARED_SECRET` header |
| F-06 | Migration 002 left permissive INSERT on `public.users` | `078_security_hardening.sql` drops the bad policy and creates a `service_role`-only INSERT, leaving the owner-self-insert from migration 001 intact |
| F-07 | `public.cron_config` had no RLS | `078_security_hardening.sql` enables RLS, restricts to `service_role`, revokes anon/authenticated grants |
| F-08 | Client `supabase.ts` shipped a hardcoded Supabase URL + anon JWT fallback | Fallback removed; supabase-js fails loudly if env vars are missing (`validateEnv` already throws in dev) |
| F-09 | `delete-account` echoed full error detail | Server-side log, generic client message |
| F-10 | `confirm-quote-payment` returned stack traces | Server-side log, generic client message |
| F-12 | Storage UPDATE/DELETE allowed for any auth user | `078_security_hardening.sql` adds owner-scoped policies on `storage.objects` for `content-videos` and `content-images` |
| F-15 | `service_requests` had no SELECT for owner | `078_security_hardening.sql` adds `auth.uid() = requester_id` SELECT policy |
| F-19 | Edge functions returning raw Stripe / DB errors | Refund + confirm + delete-account now scrub error messages |
| F-20 | Cleaner onboarding logged `userId` + `userEmail` | Logs trimmed to last-4 of id, no email |
| F-21 | `guestModeService.isGuestUser` logged raw user object | Logs reduced to a boolean (dev-only) |

## Deferred MEDIUM findings (with rationale)

| ID | Title | Why deferred |
|---|---|---|
| F-11 | `public.jobs` RLS lets any cleaner SELECT all jobs | Product decision: marketplace listing currently relies on this. Plan: split SELECT from write policies and scope by region in a follow-up |
| F-13 | `verification-webhook` trusts `user_id` in body | Provider-specific HMAC required; will land with the real ID-verification provider integration |
| F-14 | Cron jobs accept invocation without `CRON_SECRET` if env is unset | Operational fix: set `CRON_SECRET` in production. Documented in README production checklist |
| F-16 | `content_notifications` has no INSERT policy | App relies on triggers/service role; confirmed no client-driven insert |
| F-17 | `waitlist_signups` `INSERT WITH CHECK (true)` | Intentional public sign-up; rate limiting belongs in app/gateway |
| F-18 | Social tables `SELECT USING (true)` | Intentional public social graph; document in product threat model |
| F-23 / F-24 | `LIVE_READINESS_SETUP.sql` `payments` policies + missing migration | Not in `migrations/` — operator-only file. Tracked separately |

## Low-severity advisory items (F-22, F-25–F-27)

- **F-22** Stripe webhook missing `Stripe-Signature` already fails safely in `constructEvent`.
- **F-25** Run `npm audit` per release; bump majors with QA.
- **F-26** No unauthenticated magic-link auto-login found; keep it that way.
- **F-27** `refreshSession` already handles invalid tokens without recursion.

## Operator runbook

After deploying this release:

1. Apply `chorehero-app/supabase/migrations/078_security_hardening.sql`. The storage policy block uses an `EXCEPTION` guard for environments where the migration role can't touch `storage.objects` — apply those two policies via the Supabase dashboard if the migration logs `Skipped storage.objects policy update`.
2. Set the following Edge Function secrets:
   - `INTERNAL_SHARED_SECRET` (any high-entropy random string) — required for trusted server-to-server calls into `send-push`, `process-refund`, `notify-founder-sms`. Rotate quarterly.
   - `CRON_SECRET` (already documented) — required by `process-payouts`, `archive-old-jobs`, `cleanup-storage`.
3. Re-run [`chorehero-app/supabase/audit/rls_audit.sql`](../supabase/audit/rls_audit.sql) and update [`RLS_REPORT.md`](../supabase/audit/RLS_REPORT.md).
4. Run `npm audit --omit=dev` and triage HIGH/CRITICAL findings.

## Out-of-scope for static audit

- Whether `002`'s bad insert policy was already manually dropped on prod (the migration in this PR is idempotent — safe to re-apply).
- Production grants on `public.cron_config` and `public.payments`.
- Supabase per-project `Verify JWT` defaults for every function (audit assumed migration `config.toml`).
- Rate limits / WAF / abuse on Edge endpoints.
- Live npm-audit results.
