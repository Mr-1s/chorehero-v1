# ChoreHero Planning Notes

## Product Flow Source of Truth

### Onboarding and Auth
- Auth supports email/password and OAuth; routing is handled centrally via auth state.
- New users without a `public.users` profile are allowed to proceed to onboarding.
- Customer onboarding is considered complete once location is set; the app routes into `MainTabs`.
- A provisional role may be used during onboarding until the profile is fully created.

### Waitlist and Global View
- When a user joins the waitlist, they are routed directly to the global feed view.
- Global view is triggered automatically when the local feed has no available pros.
- Navigation to global view happens inside `MainTabs` to keep tab state consistent.

### Booking Flow (Customer)
- Video feed booking opens a scheduling sheet, then routes to `BookingSummaryScreen`.
- `BookingSummaryScreen` is the Service Configuration gate:
  - Service duration stepper (min 2 hours, 0.5 hour increments).
  - Address selection or entry with required entry instructions.
  - Property details (bed/bath, square feet, pets).
  - Payment method gate; booking only proceeds once a card is present.
- Final confirmation creates the booking and navigates to `BookingConfirmation`.

## Design System
- Unified brand color: `#26B7C9` (use for primary CTAs and key accents).

## Notes
- Keep booking logic consistent between UI and booking payloads.
- Prefer resilient routing: always reset to `MainTabs` when leaving auth or waitlist.
