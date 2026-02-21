## Active Tasks
- 2026-01-24: Push build to TestFlight, update Expo, push git.
- 2026-01-24: Schedule process-payouts Edge Function (Supabase Cron or external cron with CRON_SECRET).

## Completed Tasks
- 2026-01-24: 4-step cleaner onboarding refactor (Profile, Service Area+Equipment, Create Package, Review); migration 042 (provides_equipment, provides_supplies, package_type contact); background check gate in acceptBooking.
- 2026-01-24: Responsive sizing (react-native-responsive-screen): VideoFeedScreen, BookingSummaryScreen, CleanerProfileScreen, IndividualChatScreen, PaymentScreen updated with wp()/hp() for iPhone SE, 14 Pro Max, iPad.
- 2026-01-24: Critical fixes: Push notifications for new jobs (find_cleaners_for_job RPC, trigger, send-push Edge Function, notifyCleanersOfNewJob); Start Traveling button in JobDetailsScreen with real coordinates; Fix cancellation flow to use cancel_booking_with_refund RPC; Real-time job subscription in JobsScreenNew; Payout visibility on JobCard; cancelJob in cleanerBookingService; no-show migration (031) + Running Late UI.
- 2026-01-24: Pre-launch audit: migration 027 (partial payout unique, DB chat filter, feed cold start, cron logs, booking notifications), Stripe account check in process-payouts.
- 2026-01-24: Pre-launch checklist: process-payouts + process-refund Edge Functions, webhook idempotency, complete_booking RPC, Mark Complete flow, chat keyword filtering, get_ranked_cleaner_feed RPC.
- 2026-01-25: Fix role selection routing on signup.
 - 2026-01-24: Refactor cleaner nav, jobs tab, pro dashboard UI.
 - 2026-01-24: Wire profile navigation screens.
 - 2026-01-24: Fix job request payout/vibe fields.
 - 2026-01-24: Add Jobs badge + job details household/payout.
 - 2026-01-23: Finalize chores feed UI header/nav/notifications.
 - 2026-01-24: Finalize chores feed UI + pro notif hooks.
 - 2026-01-24: Fix chat_messages sender FK join.
 - 2026-01-24: Refresh profile quick actions + stats row.
 - 2026-01-24: Add refer card + favorites toggle.
 - 2026-01-24: Guard cleaner address inserts.
 - 2026-01-24: Premium cleaner onboarding refactor.
- 2026-01-23: Unify message threads by conversation_id.
- 2026-01-23: Wire live tracking to real-time updates.
- 2026-01-23: Polish messages UI and quick replies.
- 2026-01-23: Refine hero nav bar glassmorphism and badges.
- 2026-01-23: Polish booking address/live badge/CTA ordering.
- 2026-01-23: Refactor bottom tab navigation styling/logic.
- 2026-01-23: Enforce payment and persist booking property fields.
- 2026-01-23: Add PLANNING.md source of truth.
- 2026-01-23: Expand BookingSummary into service configuration screen.
- 2026-01-23: Fix sign-in routing for existing users (avoid role re-prompt).
- 2026-01-23: Route waitlist/global view into MainTabs Content.
- 2026-01-23: Keep LocationLock completion inside MainTabs Content.
- 2026-01-23: Allow user profile creation before role/phone set.
- 2026-01-23: Add missing FK for content_posts user join.
- 2026-01-23: Add missing FK for cleaner_profiles user join.

## Discovered During Work
- 2026-01-23: Global feed entry should use nested Content route.
