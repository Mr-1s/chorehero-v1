# ChoreHero Professional (Cleaner) Booking Flow Audit

**Date:** January 2025  
**Focus:** Discovery → Acceptance → Pre-Job → Execution → Completion → Payout

---

## Pre-Launch Verification (Jan 2025)

| Item | Status | Notes |
|------|--------|-------|
| **Push token registration** | ✅ | `pushNotificationService.initialize(userId)` in App.tsx; `savePushToken` with `onConflict: 'user_id'`; migration 032 creates `user_push_tokens` |
| **Background GPS** | ✅ | `UIBackgroundModes: ["location"]`, `ACCESS_BACKGROUND_LOCATION`; `enhancedLocationService` uses `foregroundService` for Android |
| **Stripe onboarding check** | ✅ | `cleanerBookingService.acceptBooking` blocks if `!stripe_onboarding_complete`; error message guides to Profile → Earnings |
| **Cron monitoring** | ✅ | `process-payouts` inserts into `cron_logs` (migration 027); alert if no log in 2+ hours |
| **Customer live tracking** | ⚠️ | LiveTrackingScreen exists; customer visibility of "cleaner en route" — verify in v1.1 |

---

## 1. DISCOVERY & LEADS

### STATUS: Partial

### FLOW
1. Cleaner opens **Jobs** tab (JobsScreenNew) → fetches via `cleanerStore.fetchDashboard()` → `cleanerBookingService.getAvailableBookings(cleanerId)`
2. Available jobs: `status = 'pending'`, `cleaner_id IS NULL`, `scheduled_time >= now`
3. Jobs tab has: **New Requests** | **Upcoming** | **History**
4. Filter pills: All Jobs / Today / Tomorrow / This Week (via `selectFilteredBookings`)
5. JobCard shows: customer name, address, payout, service type, duration, date/time
6. No search by service type, distance, or minimum price

### FILES
- `src/services/cleanerBookingService.ts` — `getAvailableBookings`, `subscribeToNewBookings`
- `src/screens/cleaner/JobsScreenNew.tsx`
- `src/screens/cleaner/DashboardScreen.tsx`
- `src/store/cleanerStore.ts`
- `src/components/cleaner/JobCard.tsx`

### GAPS
- **No push notifications** for marketplace jobs — `sendBookingNotification` only runs when `cleaner_id` is set; marketplace jobs have `cleaner_id = null`, so cleaners are never notified of new jobs
- **`subscribeToNewBookings` exists but is unused** — real-time subscription is not wired into JobsScreen; discovery is polling-only
- **No distance/radius filtering** — `service_radius_km` is in cleaner_profiles but not applied to `getAvailableBookings`
- **No service type or price filters** — cleaners see all pending jobs in their area (or all if no geo filter)
- **Customer rating not shown** — JobCard shows `customerRating: 4.8` (hardcoded TODO)
- **Full address shown before accept** — `addressLine1` visible in JobCard; access instructions after accept

### SUGGESTION
1. **Critical:** Add DB trigger or Edge Function to notify cleaners when a pending marketplace booking is created (push notification)
2. Wire `subscribeToNewBookings` into JobsScreen for real-time new job alerts
3. Apply `service_radius_km` + cleaner address in `getAvailableBookings` query
4. Add filter UI: service type, min payout, distance

---

## 2. ACCEPTANCE FLOW

### STATUS: Complete

### FLOW
1. Cleaner taps job → JobDetailsScreen or JobCard **Accept**
2. `acceptBooking(bookingId)` → `cleanerBookingService.acceptBooking()` or `bookingService.acceptJob()`
3. **Atomic claim:** `claim_booking` RPC — `SELECT ... FOR UPDATE SKIP LOCKED` on `cleaner_id IS NULL AND status = 'pending'`; on success sets `cleaner_id`, `status = 'confirmed'`
4. On failure: "Job no longer available — another cleaner accepted it first"
5. On success: `sendBookingNotification(bookingId, 'cleaner_assigned')`, chat thread created via `createOrGetChatRoom`
6. UI: Alert "Job Accepted" / "The customer has been notified"; job moves to Active tab

### FILES
- `supabase/migrations/024_atomic_booking_claim.sql` — `claim_booking` RPC
- `src/services/booking.ts` — `acceptJob`, `claim_booking`
- `src/services/cleanerBookingService.ts` — `acceptBooking`
- `src/store/cleanerStore.ts` — `acceptBooking`
- `src/screens/shared/JobDetailsScreen.tsx`
- `src/store/cleanerStore.ts`
- `src/components/cleaner/JobCard.tsx`

### GAPS
- **No dedicated confirmation screen** — success is via Alert; no "Next steps" (chat, directions, start traveling)
- **Booking_locks** — `bookingService.acceptJob` upserts to `booking_locks` but `cleanerBookingService.acceptBooking` does not; `booking_locks` table may not exist (migration 024 skipped it)

### SUGGESTION
1. Add a short confirmation screen: "Job Accepted! Next: Chat customer → Start Traveling → Arrive"
2. Minor: optional "Start Traveling" CTA on confirmation

---

## 3. PRE-JOB PREPARATION

### STATUS: Partial

### FLOW
- **Chat:** Created on accept via `createOrGetChatRoom` in `bookingService.acceptJob`; cleaner can message customer immediately
- **Address:** `addressLine1` from store; full address visible in JobDetailsScreen; `access_instructions` shown
- **"On my way":** `startTraveling(id)` → `trackingWorkflowService.startCleanerTracking()` → status `cleaner_en_route`, GPS start, push to customer
- **Arrival:** `stopCleanerTracking()` → status `cleaner_arrived`
- **Live tracking:** `LiveTrackingScreen`, `trackingWorkflowService.subscribeToCleanerLocation()` (listens to `location_updates`)
- **Directions:** `handleGetDirections` opens Maps with coordinates

### FILES
- `src/services/trackingWorkflowService.ts`
- `src/services/enhancedLocationService.ts`
- `src/screens/shared/LiveTrackingScreen.tsx`
- `src/store/cleanerStore.ts` — `startTraveling`
- `src/screens/shared/JobDetailsScreen.tsx`
- `src/services/booking.ts` — `createOrGetChatRoom`

### GAPS
- **JobDetailsScreen:** No "Start Traveling" button; flow goes directly from accepted → "Start Job" (markInProgress). JobsScreenNew/JobCard has `onStartTraveling`, but JobDetailsScreen skips en_route/arrived.
- **Location updates:** `location_updates` table usage unclear; `enhancedLocationService.handleLocationUpdate` may not write to it.
- **Hardcoded coordinates:** JobDetailsScreen uses `(37.7749, -122.4194)` instead of real address coords.
- **Pre-job checklist:** No photos, supplies confirmation, or pre-job requirements.

### SUGGESTION
1. Add "Start Traveling" to JobDetailsScreen for accepted jobs (before "Start Job")
2. Ensure `location_updates` is populated for live tracking
3. Load real coordinates from `addresses` or booking address

---

## 4. JOB EXECUTION

### STATUS: Partial

### FLOW
- **Status:** `markInProgress(id)` updates store; `cleanerBookingService.updateBookingStatus(id, 'in_progress')` sets `actual_start_time`
- JobDetailsScreen: "Start Job" → `markInProgress` → "Mark Complete"
- `jobStateManager` defines transitions (e.g. `in_progress` → `completed`, `no_show`)
- Customer: `TrackingScreen` shows timeline (scheduled → en route → arrived → in progress → completed)
- DB trigger `enqueue_cleaner_payout` runs when status becomes `completed`

### FILES
- `src/store/cleanerStore.ts` — `markInProgress`, `markCompleted`
- `src/services/cleanerBookingService.ts` — `updateBookingStatus`
- `src/services/jobStateManager.ts`
- `src/screens/shared/JobDetailsScreen.tsx`
- `src/screens/customer/TrackingScreen.tsx` (or LiveTrackingScreen)

### GAPS
- **No visible timer** for in-progress jobs.
- **No mid-job issue reporting** — `jobStateManager` has `no_show`, `incident_report` but no UI.
- **No "customer watching"** — customer can see timeline but no live view of cleaner location during job.
- **markInProgress:** `cleanerStore.markInProgress` updates local state; `cleanerBookingService.updateBookingStatus` must be called for DB persistence — verify JobDetailsScreen calls both.
- **Pause/cancel:** No UI for cleaner to pause or cancel mid-job.

### SUGGESTION
1. Add in-progress timer (elapsed time from `actual_start_time`)
2. Add "Report issue" / "Need help" for mid-job problems
3. Ensure `markInProgress` persists status to DB via `updateBookingStatus`

---

## 5. COMPLETION & PAYOUT

### STATUS: Complete

### FLOW
1. Cleaner taps "Mark Complete" → `markCompleted(id)` → `cleanerBookingService.markJobComplete()`
2. **`complete_booking` RPC:** Checks `cleaner_id`, `status = 'in_progress'`; sets `status = 'completed'`, `completed_at`
3. **Trigger `enqueue_cleaner_payout`:** Inserts into `payout_queue` (24h delay via `scheduled_at`)
4. **`process-payouts` Edge Function** (cron): Processes queue, Stripe Connect transfer to cleaner
5. **Customer:** `notify_booking_completed` trigger → "How was your cleaning? Tap to leave a review"
6. **Cleaner:** Same trigger → "Payout of $X scheduled in 24 hours"
7. **Ratings:** `RatingReviewScreen`, `ratingService.submitRating()`, `ratings` table, `update_cleaner_rating` trigger

### FILES
- `supabase/migrations/026_complete_booking_payout_unique_flagged.sql` — `complete_booking`, `enqueue_cleaner_payout`
- `supabase/migrations/027_pre_launch_audit_fixes.sql` — `notify_booking_completed` trigger
- `supabase/functions/process-payouts/index.ts`
- `src/services/cleanerBookingService.ts` — `markJobComplete`
- `src/store/cleanerStore.ts` — `markCompleted`
- `src/screens/shared/RatingReviewScreen.tsx`
- `src/screens/shared/JobDetailsScreen.tsx` — `payoutDetails` (Total Payout, rate, platform fee)
- `src/screens/cleaner/EarningsScreen.tsx`, `EarningsBreakdownScreen.tsx`

### GAPS
- **No customer approval** — customer cannot confirm before completion; cleaner can mark complete unilaterally
- **Photo upload:** RatingReviewScreen has `handlePhotoUpload` but it is a mock (Alert only)
- **Payout visibility:** Cleaner sees "Payout of $X scheduled in 24 hours" in notification; JobDetailsScreen shows `payoutDetails.payout`; EarningsScreen shows earnings breakdown. No dedicated "Payout status: $X in 24h" on the job card.
- **Payout queue:** `payout_queue` status (pending/processed/failed) not surfaced in UI

### SUGGESTION
1. Add optional customer approval or dispute flow for completion
2. Implement real photo upload for completion
3. Add "Payout: $X in 24h" badge on completed job card

---

## 6. EDGE CASES & FAILURE MODES

### STATUS: Partial

### FLOW
- **Cancellation:** `cancel_booking_with_refund` RPC; policy: >24h 100%, 2–24h 50%, <2h 0%; cleaner cancels always 100%
- **Refund:** `process-refund` Edge Function for Stripe refunds
- **BookingScreen cancel:** Direct `UPDATE status = 'cancelled'` instead of RPC; inconsistent with `bookingService.cancelBooking()`
- **No-show:** `jobStateManager` supports `no_show` and `no_show_incidents`; timeout "Cleaner did not start traveling" after 15 min
- **Support:** No support/help flow in the booking path

### FILES
- `supabase/migrations/025_rating_trigger_escrow_cancel.sql` — `cancel_booking_with_refund`
- `supabase/functions/process-refund/index.ts`
- `src/services/booking.ts` — `cancelBooking`
- `src/screens/shared/BookingScreen.tsx` — `handleCancelBooking`
- `src/services/jobStateManager.ts` — `no_show`, `scheduleTimeoutCheck`

### GAPS
- **BookingScreen cancel bypasses RPC** — uses direct UPDATE; no refund logic, no Stripe refund
- **No-show:** Flow exists in jobStateManager but no UI for customer or cleaner to report no-show
- **No compensation rules** for no-show (e.g. partial payout, credits).
- **No support/help** entry point in booking flow
- **Timeout check:** `scheduleTimeoutCheck` in jobStateManager may not be invoked (no cron/scheduler found)
- **Cleaner cancels after accepting:** No penalty UI; replacement finder not implemented
- **Customer cancels after cleaner en route:** Refund policy applies; no explicit compensation for cleaner

### SUGGESTION
1. Route all cancellations through `cancel_booking_with_refund` RPC
2. Add no-show reporting UI and compensation rules
3. Add support/help entry in booking flow
4. Implement timeout checks (cron or Edge Function)

---

## Summary Table

| Stage       | Status  | Main Gaps                                                                 |
|------------|---------|---------------------------------------------------------------------------|
| Discovery  | Partial | No push for marketplace jobs; no radius filter; subscribeToNewBookings unused |
| Acceptance | Complete| Minor: no confirmation screen                                             |
| Pre-Job    | Partial | No "Start Traveling" in JobDetailsScreen; location_updates may be unused  |
| Execution  | Partial | No timer; no mid-job issues UI; markInProgress may not persist             |
| Completion | Complete| No customer approval; photo upload mock; limited payout visibility         |
| Edge Cases | Partial | BookingScreen cancel bypasses RPC; no no-show UI; no support flow         |

---

## Priority Fixes (Revenue-Critical)

1. **Acceptance:** Already solid; add confirmation screen (quick win)
2. **Completion:** Add "Payout: $X in 24h" visibility on job card
3. **Discovery:** Add push notifications for new marketplace jobs (critical for lead generation)
4. **Edge Cases:** Route BookingScreen cancel through `cancel_booking_with_refund` RPC
