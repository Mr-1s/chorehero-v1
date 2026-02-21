# ChoreHero Current State Audit

**Date:** January 2025  
**Purpose:** Map existing booking, discovery, and cleaner flows before planning service packages.

---

## 1. DATABASE TABLES

### Core Tables (in migrations / schema.sql)

| Table | Purpose |
|-------|---------|
| `users` | Auth + role (customer/cleaner), name, avatar |
| `customer_profiles` | Preferences, total_bookings, total_spent |
| `cleaner_profiles` | hourly_rate, bio, specialties[], service_radius_km, stripe_account_id, verification_status |
| `addresses` | user_id, street, city, state, zip_code, latitude, longitude |
| `services` | **Platform-level** definitions: type (express/standard/deep), name, base_price, estimated_duration |
| `add_ons` | Platform-level add-ons (name, price, category) |
| `bookings` | customer_id, cleaner_id (nullable), service_type, address_id, scheduled_time, total_amount, etc. |
| `booking_add_ons` | Junction: booking_id, add_on_id |
| `content_posts` | user_id, title, description, content_type (video/photo/before_after), media_url, tags[], status |
| `content_interactions` | likes, views, shares |
| `content_comments` | Comments on content |
| `cleaner_availability` | day_of_week, start_time, end_time |
| `chat_threads`, `chat_messages` | Messaging |
| `ratings` | Post-job ratings |
| `notifications` | In-app notifications |
| `payout_queue` | Stripe Connect payouts |
| `provider_discovery_index` | Synced from cleaner_profiles for explore |
| `user_push_tokens` | Push notification tokens |
| `booking_templates` | **Cleaner-specific** (in booking_templates_schema.sql) — custom questions, add-ons |

### Tables NOT in migrations (reference schemas only)

| Table | Source | Status |
|-------|--------|--------|
| `cleaner_services` | complete_marketplace_schema.sql | Not in migrations |
| `service_categories` | complete_marketplace_schema.sql, category_services_migration.sql | Not in migrations |
| `booking_requests` | — | **Does not exist** |

### Key Column Details

**bookings**
- `customer_id`, `cleaner_id` (nullable for marketplace)
- `service_type` → enum: express, standard, deep (references platform `services`)
- `address_id` → addresses.id
- `status` → pending, confirmed, cleaner_en_route, in_progress, completed, cancelled
- `total_amount`, `cleaner_earnings`, `platform_fee`

**content_posts**
- `user_id`, `title`, `description`, `content_type`, `media_url`, `thumbnail_url`
- `tags` (TEXT[]), `status` (draft/published/archived)
- `view_count`, `like_count`, `comment_count`

**cleaner_profiles**
- `hourly_rate`, `specialties` (TEXT[]), `service_radius_km`
- No per-cleaner service packages; uses platform `services` + `hourly_rate`

**services** (platform-level)
- `type` (express/standard/deep), `name`, `base_price`, `estimated_duration`
- One row per service type; not per-cleaner

---

## 2. CURRENT BOOKING FLOW

### Flow A: Video Feed / Cleaner Profile → BookingSummary → bookingService.createBooking

1. **Discovery:** Customer sees video in VideoFeedScreen or CleanerProfileScreen
2. **Book CTA:** Tap "Book" → `navigation.navigate('BookingSummary', { cleanerId, cleanerName, hourlyRate, selectedService, selectedTime })`
3. **BookingSummaryScreen:** Customer enters address, bedrooms, bathrooms, payment method
4. **Submit:** `bookingService.createBooking({ customer_id, cleaner_id, service_type, address_id, scheduled_time, ... })`
5. **Result:** Booking created with `address_id`, proper schema; chat thread created; notification sent

**Files:** `BookingSummaryScreen.tsx`, `booking.ts` (createBooking)

### Flow B: NewBookingFlow → Direct supabase insert

1. **Entry:** From DiscoverScreen, ServiceDetailScreen, or DashboardScreen
2. **NewBookingFlowScreen:** Multi-step form (service, date/time, location, details)
3. **Submit:** `supabase.from('bookings').insert({ ... })` — **direct insert**, not bookingService
4. **Schema mismatch:** Uses `address` (text) instead of `address_id`; `apartment_unit` may not exist in schema
5. **Result:** Booking created; notification sent to cleaner; does NOT use bookingService (no chat, different flow)

**Files:** `NewBookingFlowScreen.tsx` (lines ~509–531)

### Payment

- **PaymentScreen:** Uses `create-payment-intent` Edge Function with `bookingId` only
- **Stripe:** Authorize on booking; capture on completion via `complete_booking` RPC

### Completion

- Cleaner: `markJobComplete` → `complete_booking` RPC → `enqueue_cleaner_payout`
- Cron: `process-payouts` runs hourly

---

## 3. CURRENT VIDEO FEED

### Data Source

- **Primary:** `get_ranked_cleaner_feed` RPC (migration 027)
  - Joins `content_posts` + `cleaner_profiles` + `addresses`
  - Ranks by: distance, rating, availability, view count
  - Returns `content_id`, `user_id`, `media_url`, `rank_score`
- **Fallback:** Client-side ranking via `videoFeedAlgorithmService.getRankedFeed` → `getRawContentWithCleaners` (content_posts + users + cleaner_profiles)

### What Populates the Feed

- **content_posts** where `status = 'published'`
- `user_id` = cleaner (must have `cleaner_profiles` row)
- Fields: `title`, `description`, `media_url`, `tags`, `view_count`, `like_count`

### How Cleaners Appear in the Feed

1. **VideoUploadScreen** → `contentService.createPost()` → `content_posts.insert()`
2. Cleaner uploads video, adds title/description, optional service type tag
3. Post goes to `content_posts` with `user_id` = cleaner
4. `provider_discovery_index` syncs from cleaner_profiles (migration 010)
5. Feed shows videos from cleaners in radius (or all if no location)

### No "Service" Link in Feed

- Feed shows **content_posts** (videos), not services
- Booking uses `cleaner_profiles.hourly_rate` + platform `services` base pricing
- No per-cleaner "packages" or "services" in the feed

---

## 4. CLEANER ONBOARDING

### What Cleaners Create (CleanerOnboardingScreen)

| Created | Table | Fields |
|---------|-------|--------|
| Profile | `cleaner_profiles` | hourly_rate, bio, years_experience, specialties[], service_radius_km |
| Address | `addresses` | street, city, state, zip_code (if provided) |
| User metadata | `users` | cleaner_onboarding_state, cleaner_onboarding_step |

### What Cleaners Do NOT Create During Onboarding

- **No content_posts** — videos are uploaded later in VideoUploadScreen
- **No services** — platform `services` table is pre-seeded (express, standard, deep)
- **No booking_templates** — those are created in BookingCustomizationScreen (separate flow)
- **No per-cleaner packages** — only `hourly_rate` + `specialties` array

### Post-Onboarding

- **VideoUploadScreen:** Upload videos → `content_posts`
- **BookingCustomizationScreen:** Create `booking_templates` (custom questions, add-ons)
- **ScheduleScreen:** Set `cleaner_availability`
- **ProfileScreen:** Stripe Connect onboarding

---

## 5. MAIN CODE FILES

### Customer Booking

| File | Role |
|------|------|
| `VideoFeedScreen.tsx` | Feed; "Book" → BookingSummary |
| `CleanerProfileScreen.tsx` | Profile; "Book" → BookingSummary |
| `DiscoverScreen.tsx` | Explore; can → NewBookingFlow |
| `BookingSummaryScreen.tsx` | Address, payment, submit via bookingService.createBooking |
| `NewBookingFlowScreen.tsx` | Alternate flow; direct supabase insert |
| `booking.ts` | createBooking, cancelBooking, getCustomerBookings |
| `PaymentScreen.tsx` | create-payment-intent, confirm payment |

### Cleaner Job Management

| File | Role |
|------|------|
| `JobsScreenNew.tsx` | Available / Active / History tabs |
| `JobDetailsScreen.tsx` | Accept, Start Traveling, Start Job, Complete |
| `cleanerBookingService.ts` | getAvailableBookings, acceptBooking, markJobComplete |
| `cleanerStore.ts` | Zustand store for cleaner state |

### Feed / Discovery

| File | Role |
|------|------|
| `VideoFeedScreen.tsx` | Main feed UI |
| `videoFeedAlgorithmService.ts` | getRankedFeed, getRankedFeedFromRpc |
| `contentService.ts` | createPost, updatePost, deletePost |
| `VideoUploadScreen.tsx` | Cleaner uploads videos |
| `DiscoverScreen.tsx` | Search/explore by tags |

### Cleaner Onboarding / Profile

| File | Role |
|------|------|
| `CleanerOnboardingScreen.tsx` | 6-step onboarding; creates cleaner_profiles |
| `BookingCustomizationScreen.tsx` | booking_templates (custom questions) |
| `VideoUploadScreen.tsx` | content_posts (videos) |

---

## 6. SUMMARY: WHAT EXISTS vs WHAT'S NEEDED FOR PACKAGES

| Current State | Action for Service Packages |
|---------------|-----------------------------|
| `services` table exists (platform-level) | Extend or add `cleaner_services` for per-cleaner packages |
| Cleaners upload videos to `content_posts` | Repurpose tags or add `service_id` link; or keep separate |
| Customers book via BookingSummary (cleaner + hourly rate) | Add package selection step; link booking to package |
| No "service" concept per cleaner | Build `cleaner_services` or similar |
| `booking_templates` exist (custom questions) | Can extend for package-specific questions |
| No `booking_requests` table | Not needed if direct book; only if moving to bid model |
| `bookings.service_type` = platform enum | May need `cleaner_service_id` or package reference |
