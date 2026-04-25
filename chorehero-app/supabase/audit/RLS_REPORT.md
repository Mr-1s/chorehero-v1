# RLS Audit Report

> Living document. Re-run [`rls_audit.sql`](./rls_audit.sql) against the production Supabase project after every migration that adds a table or policy, and update the findings below.

## How to run

1. Open the Supabase dashboard → **SQL Editor**.
2. Paste the contents of [`rls_audit.sql`](./rls_audit.sql).
3. Run each section. Capture the output and update the findings tables below.

## Expected `public.*` tables

Derived from the migrations in `chorehero-app/supabase/migrations/`. Every table here should have `rls_enabled = true` and at least one policy that scopes by `auth.uid() = user_id` (or an equivalent join).

| Table | First introduced | Expected scope |
|---|---|---|
| `users` | `001_initial_schema.sql`, `002_users_table.sql` | `auth.uid() = id` |
| `customer_profiles` | `001_initial_schema.sql` | `auth.uid() = user_id` |
| `cleaner_profiles` | `001_initial_schema.sql` | `auth.uid() = user_id` |
| `addresses` | `001_initial_schema.sql` | `auth.uid() = user_id` |
| `bookings` | `001_initial_schema.sql` | customer or cleaner participant |
| `booking_add_ons` | `001_initial_schema.sql` | join through `bookings` |
| `booking_answers` | `068_dynamic_service_templates_followups.sql` | join through `bookings` |
| `booking_locks` | `024_atomic_booking_claim.sql` | service-role only (writes via RPC) |
| `payment_methods` | (inferred) | `auth.uid() = user_id` |
| `payouts` / `payout_queue` | `026_complete_booking_payout_unique_flagged.sql` | service-role writes, cleaner-self reads |
| `notifications` | `001_initial_schema.sql` | `auth.uid() = user_id` |
| `chat_threads`, `chat_messages` | `041_add_chat_tables_if_missing.sql`, `057_messaging_post_payment_only.sql` | participant of the thread |
| `content_posts` | `004_content_tables_only.sql` | `auth.uid() = user_id` (for INSERT/UPDATE/DELETE), public SELECT |
| `content_interactions`, `content_views`, `content_notifications`, `comment_likes` | `004_content_tables_only.sql` | `auth.uid() = user_id` |
| `user_follows` | `004_content_tables_only.sql` | `auth.uid() = follower_id` |
| `jobs`, `job_media`, `quotes` | `047_video_quote_jobs.sql`, `048_add_quote_id_to_bookings.sql` | scope to customer/pro participant |
| `cleaner_availability` | (inferred from `availabilityService.ts`) | `auth.uid() = cleaner_id` |
| `services`, `pro_services` | `067/068_dynamic_service_templates*.sql` | public SELECT, service-role writes |
| `waitlist_leads` | `012_explore_locations_waitlist.sql`, `074_waitlist_admin_select_policy.sql` | public INSERT, admin SELECT |
| `user_presence` | (inferred from `presenceService.ts`) | `auth.uid() = user_id` |
| `location_updates` | (inferred from `enhancedLocationService.ts`) | `auth.uid() = user_id` |
| `user_push_tokens` | `032_user_push_tokens.sql` | `auth.uid() = user_id` |
| `background_checks` | `043_background_checks_mvp.sql` | `auth.uid() = user_id`, admin SELECT |

## Findings template

After running `rls_audit.sql`, fill in the tables below.

### 1. Tables without RLS enabled (HIGH RISK)

> Any row here is a critical finding. Production must have RLS enabled on every `public.*` table that holds user data.

| Table | Notes |
|---|---|
| _(none expected)_ | |

### 2. Tables with RLS enabled but **no policies**

> These tables are effectively unreadable / unwritable except via service role. May be intentional (server-managed audit logs) or a bug (forgot to add a policy after enabling RLS).

| Table | Intentional? | Action |
|---|---|---|
| | | |

### 3. Policies that do not reference `auth.uid()` or `auth.role()`

> Flag for manual review. Legitimate cases: public catalog SELECTs (`services`, `pro_services`). Suspect cases: any INSERT/UPDATE/DELETE that doesn't scope to the caller.

| Table | Policy | cmd | qual | Verdict |
|---|---|---|---|---|
| | | | | |

### 4. Recent migration changes

> Note any policy changes from migrations 040, 044, 046, 053 (security-advisor fixes) and any migration that adds a table.

| Migration | Affected tables | Verified post-deploy? |
|---|---|---|
| `040_rls_security_advisor_fixes.sql` | (fill in) | |
| `044_security_advisor_2_errors.sql` | (fill in) | |
| `046_security_advisor_6_errors.sql` | (fill in) | |
| `053_provider_discovery_index_rls_fix.sql` | (fill in) | |

## Action items

- [ ] Run `rls_audit.sql` against production and capture output.
- [ ] Compare against the "Expected `public.*` tables" list above and flag any new tables that aren't documented.
- [ ] Fix any HIGH RISK rows (Section 1).
- [ ] Decide on policies for any "no policies" rows (Section 2).
- [ ] Review Section 3 policies and add `auth.uid()` scoping if writes are involved.
