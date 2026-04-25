# ChoreHero TestFlight Smoke Checklist

Run this checklist on a TestFlight build (or a dev build on a real device — Expo Go is too lenient for some of these) before promoting any release. It exists to catch regressions of the bugs fixed in the recent stabilization sprint.

If a step fails, file an issue **and** add it to the regression test suite under `chorehero-app/__tests__/services/` (so the same bug can never silently come back).

Format: `[ ]` for each step. Tester's initials + date in the header.

> Tester: ___ Date: ___ Build: ___

---

## Auth & onboarding

- [ ] Sign up with a new email; reach the role selection screen
- [ ] Press Back on the role selection screen; you land on Welcome (NOT the customer home)
- [ ] Pick "Find a ChoreHero"; reach LocationLock
- [ ] Sign out from Settings; the screen returns to Welcome within ~1 second (no spinner stall)

## Customer profile

- [ ] Open Edit Profile; the Email field is read-only with helper text
- [ ] Tap Save with name + phone filled; banner says "Profile updated successfully" and the values persist after backgrounding
- [ ] (As a customer with NO cleaner_profiles row) Save succeeds without zip / bio / hourly-rate validation errors

## Customer payment

- [ ] Open Settings → Payment Methods → Add card
- [ ] If the build is missing `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, an alert says "Payments not configured" (instead of a generic Stripe error)
- [ ] Otherwise the Stripe payment sheet opens, you can save a test card, and the card appears in the list
- [ ] Double-tap the "Add Card" button — only one Stripe sheet opens (no duplicate setup intents)

## Customer post a job

- [ ] Open Post a Job; partial form persists if you switch tabs and come back
- [ ] Submit with no media — job is posted, you land on Bookings → my-jobs
- [ ] Submit with 3 photos; job is posted with photos attached
- [ ] Submit with 3 photos while on slow / no network: every upload fails → you see a clear error message (NOT a silent success)
- [ ] Submit while another submission is already in flight (double-tap) → second tap is rejected with "A job post is already being submitted"
- [ ] Job's media survives an edit → updateJob: change description and one media item, save, reopen → media still present

## Cleaner job board

- [ ] Toggle Online/Offline on the Dashboard; the dot color flips and persists across app restart
- [ ] Toggle Online/Offline on the Profile screen; both screens stay in sync
- [ ] Accept a booking; double-tap the Accept button → only one accept fires (no duplicate notifications)
- [ ] Mark complete a booking; double-tap → only one completion fires

## Cleaner profile + completion

- [ ] Avatar uploads from camera / library and persists across app restart
- [ ] Profile completion percentage updates when you finish a step (background check ↔ verified counts)
- [ ] No "Continue" button on the profile completion card (removed)
- [ ] No eye toggle on the dashboard (removed)
- [ ] Cleaner sign-up flow uses a single orange brand color throughout

## Cleaner video upload

- [ ] Record a short video, fill in title/description, post
- [ ] If the storage upload succeeds but the `content_posts` insert fails, the toast says "Upload finished but we couldn't post it" (NOT "Video is now live")
- [ ] After a successful post, the video appears in the cleaner's profile feed AND in the customer-side video feed

## Notifications

- [ ] Notification badge shows the unread count on the cleaner Dashboard and customer BookingScreen
- [ ] Open Notifications, tap a notification → the unread badge count drops by one when you return to the previous screen
- [ ] "Mark all as read" clears the badge instantly and the count stays at 0 after a refresh

## Quotes (cleaner viewing customer's quote screen)

- [ ] From the cleaner's "Today's job" callout (Quotes tab), tap → opens the same Quote screen as the customer
- [ ] The cleaner's own quote appears in the list regardless of status (pending, viewed, accepted)
- [ ] Pro view is orange-themed, no teal bleed

## Boot-time guards

- [ ] In dev, removing `EXPO_PUBLIC_SUPABASE_URL` from `.env` fails fast with a red box
- [ ] In TestFlight (where you can't easily remove env vars), the validateEnv log line is still in the device console at boot

---

## Out-of-scope but worth eyeballing

- [ ] No teal accents in cleaner-only UI; no orange in customer-only UI
- [ ] `useFocusEffect` refresh patterns still work (notification count, quote count, etc.) — i.e. nothing got broken by the silent-error / dedup changes
