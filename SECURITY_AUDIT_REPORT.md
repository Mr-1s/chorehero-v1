# ChoreHero Security Audit Report

**Date:** January 2025  
**Scope:** React Native + Supabase marketplace app  
**Focus:** Critical and High severity issues

---

## CRITICAL

### 1. create-payment-intent: No JWT verification + trusts client-supplied amount

**FILE:** `.github/workflows/deploy-supabase.yml` (line 29)  
**FILE:** `chorehero-app/supabase/functions/create-payment-intent/index.ts` (lines 26-55)

**ISSUE:** 
- Edge function deployed with `--no-verify-jwt` (no authentication required)
- Accepts `bookingId`, `cleanerAccountId`, `subtotal_cents`, `tip_cents` from request body without validation
- Does not verify: (a) caller is the booking customer, (b) `cleanerAccountId` matches the booking's cleaner, (c) amount matches stored booking total

**EXPLOIT:** Unauthenticated attacker can:
1. Create PaymentIntents with arbitrary `subtotal_cents` (pay $0.01 for a $500 booking)
2. Redirect payments to any Stripe Connect account via `cleanerAccountId`
3. Steal payments by specifying their own Connect account as destination

**FIX:**
```yaml
# .github/workflows/deploy-supabase.yml - REMOVE --no-verify-jwt for create-payment-intent
supabase functions deploy create-payment-intent
# Keep --no-verify-jwt only for stripe-webhook (Stripe sends signature, not JWT)
supabase functions deploy stripe-webhook --no-verify-jwt
```

In `create-payment-intent/index.ts`:
- Verify JWT: `const authHeader = req.headers.get('Authorization');` and validate
- Fetch booking from DB: `SELECT customer_id, cleaner_id, total_amount FROM bookings WHERE id = $1`
- Assert `customer_id = auth.uid()` (caller is the customer)
- Assert `cleanerAccountId` matches the cleaner's Stripe Connect account
- Compute amount server-side from booking; reject if `subtotal_cents` differs beyond tolerance

---

### 2. PaymentScreen / create-payment-intent payload mismatch

**FILE:** `chorehero-app/src/screens/shared/PaymentScreen.tsx` (lines 297-306)  
**FILE:** `chorehero-app/supabase/functions/create-payment-intent/index.ts` (lines 5-12)

**ISSUE:** PaymentScreen sends:
```js
{ amount, currency, cleanerId, customerId }
```
Edge function expects:
```ts
{ bookingId, cleanerAccountId, subtotal_cents, tip_cents, add_ons_cents, discount_cents }
```

**EXPLOIT:** Payment flow is broken or uses undefined values. `body.bookingId` and `body.cleanerAccountId` are undefined; `body.subtotal_cents` is undefined. The function may crash or create invalid PaymentIntents.

**FIX:** Align PaymentScreen with create-payment-intent:
- Pass `bookingId` (from route params)
- Fetch `cleanerAccountId` server-side in the Edge Function from the booking's cleaner
- Pass `subtotal_cents`, `tip_cents` from booking total (or compute server-side)
- Remove client-supplied `cleanerId`/`customerId` from payment creation

---

### 3. stripe_account_id exposed via client queries

**FILE:** `chorehero-app/src/services/stripe.ts` (lines 412-422)  
**FILE:** `chorehero-app/supabase` (no RLS policies found for `stripe_connect_accounts`)

**ISSUE:** 
- `getCleanerStripeAccountId(cleanerId)` queries `stripe_connect_accounts` with `.select('stripe_account_id')` from the client
- If `stripe_connect_accounts` table exists without RLS, any authenticated user could query any cleaner's Stripe Connect account ID
- `cleaner_profiles.stripe_account_id` is also exposed if RLS allows reading other cleaners' profiles

**EXPLOIT:** Attacker with valid JWT could enumerate all `stripe_account_id` values and attempt to redirect payments or abuse Stripe APIs.

**FIX:**
- Add RLS on `stripe_connect_accounts`: `SELECT` only where `user_id = auth.uid()`
- For payment flow: fetch `cleanerAccountId` in the Edge Function (server-side) using service role, never from client
- Restrict `cleaner_profiles` SELECT so `stripe_account_id` is not returned to non-owners (or use a view that excludes it for discovery)

---

## HIGH

### 4. Self-booking (customer = cleaner) not blocked

**FILE:** `chorehero-app/supabase/migrations/017_add_booking_insert_policies.sql` (lines 3-4)  
**FILE:** `chorehero-app/src/services/booking.ts` (lines 214-217)

**ISSUE:** Insert policy only checks `auth.uid() = customer_id`. No constraint prevents `cleaner_id = customer_id`.

**EXPLOIT:** User with both customer and cleaner profiles can create a booking where they are both parties, enabling:
- Self-payment (pay themselves)
- Fake ratings (rate themselves)
- Gaming completion stats

**FIX:**
```sql
-- Add to migrations
ALTER TABLE bookings ADD CONSTRAINT chk_no_self_booking 
  CHECK (cleaner_id IS NULL OR cleaner_id != customer_id);
```

In `booking.ts`, add validation before insert:
```ts
if (request.cleaner_id && request.cleaner_id === request.customer_id) {
  throw new Error('Cannot book yourself');
}
```

---

### 5. Over-permissive RLS: USING (true) on content tables

**FILE:** `chorehero-app/supabase/migrations/004_content_tables_only.sql` (lines 117-118, 134-135, 151-152)

**ISSUE:**
- `content_interactions` — `FOR SELECT USING (true)`
- `content_comments` — `FOR SELECT USING (true)`  
- `user_follows` — `FOR SELECT USING (true)`

**EXPLOIT:** Any authenticated user can read all likes, comments, and follow relationships. Enables scraping, privacy violations, and targeted harassment.

**FIX:** Restrict SELECT:
- `content_interactions`: allow if viewer is content owner or interaction participant
- `content_comments`: allow if content is published (already filtered by content_posts policy) or viewer is participant
- `user_follows`: allow if viewer is follower or followee, or limit to public follower counts

---

### 6. users table was exposed via USING (true) — verify migration 024 applied

**FILE:** `chorehero-app/supabase/migrations/001_initial_schema.sql` (line 328)  
**FILE:** `chorehero-app/supabase/migrations/024_atomic_booking_claim.sql` (lines 46-77)

**ISSUE:** Original policy `"Users can view others basic info" ON users FOR SELECT USING (true)` exposed all user rows (phone, email, etc.). Migration 024 replaces it with stricter policies (`users_see_self`, `customers_see_verified_cleaners`, `booking_parties_see_each_other`).

**EXPLOIT:** If migration 024 is not applied, any authenticated user can read all users' PII.

**FIX:** Ensure `024_atomic_booking_claim.sql` is applied in all environments. Run `npx supabase db push` and verify no `USING (true)` remains on `users`.

---

### 7. stripe.ts uses undefined platformFeePercentage

**FILE:** `chorehero-app/src/services/stripe.ts` (lines 15, 71)

**ISSUE:** Config defines `platformFeeBps` but `calculatePaymentBreakdown` uses `STRIPE_CONFIG.platformFeePercentage`:
```ts
const platformFee = Math.round(subtotal * STRIPE_CONFIG.platformFeePercentage);
```
`platformFeePercentage` is undefined → `NaN`, breaking client-side payment display.

**EXPLOIT:** UI shows incorrect breakdown; users may be confused about fees. Not a direct security issue but affects trust.

**FIX:**
```ts
// Use platformFeeBps: (subtotal * 1900) / 10000
const platformFee = Math.round((subtotal * STRIPE_CONFIG.platformFeeBps) / 10000);
```

---

### 8. LIVE_READINESS_SETUP.sql uses broad auth.role() policies

**FILE:** `chorehero-app/supabase/LIVE_READINESS_SETUP.sql` (lines 347-358)

**ISSUE:** Policies like `FOR ALL USING (auth.role() = 'authenticated')` on `payments`, `user_payment_methods`, `chat_messages`, `bookings` allow any authenticated user full CRUD.

**EXPLOIT:** Any logged-in user can read/update/delete other users' payments, payment methods, and messages.

**FIX:** Do not use LIVE_READINESS_SETUP.sql for production if it overwrites stricter migrations. Prefer migrations 001, 017, 024, 028 with row-level checks. If used, replace with policies like `user_id = auth.uid()` or booking-party checks.

---

## MEDIUM (Summary)

| # | Issue | File | Fix |
|---|-------|------|-----|
| 9 | chat_messages has no DELETE policy | 001_initial_schema.sql | Add `FOR DELETE USING (auth.uid() = sender_id)` |
| 10 | Chat keyword filter bypass (Unicode, spacing) | messageService.ts, 027 | Normalize text (NFKC), expand blocklist |
| 11 | IDOR risk in claim_booking / complete_booking | cleanerBookingService, booking.ts | RPCs use SECURITY DEFINER; verify all validate auth.uid() |
| 12 | access_instructions exposed to cleaners | addresses RLS | Intended; consider encryption or time-limited access |

---

## RECOMMENDED PRIORITY

1. ~~**Immediate:** Fix create-payment-intent auth + server-side amount validation (Critical #1, #2)~~ **DONE**
2. ~~**Immediate:** Add RLS for stripe_connect_accounts; fetch cleanerAccountId server-side (Critical #3)~~ **DONE**
3. ~~**High:** Add self-booking constraint and app validation (High #4)~~ **DONE**
4. ~~**High:** Fix platformFeePercentage in stripe.ts (High #7)~~ **DONE**
5. **High:** Restrict content_interactions, content_comments, user_follows SELECT (High #5)
