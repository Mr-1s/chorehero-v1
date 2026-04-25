# ChoreHero v2

A two-sided marketplace connecting customers with trusted local pros for cleaning, handyman, organizing, and other home services. Built around video-first discovery and quote-driven booking.

## Stack

- **Mobile app**: React Native + Expo (managed workflow)
- **Backend**: Supabase (Postgres, Auth, Storage, Edge Functions, Realtime)
- **Payments**: Stripe (Payment Sheet for customers, Stripe Connect for cleaner payouts)
- **State**: Zustand (cleaner side) + React state + Context (auth, messages)
- **Navigation**: React Navigation (stack + bottom tabs)

## Quick start

```bash
# 1. Install dependencies
cd chorehero-app
npm install

# 2. Configure environment
cp .env.example .env
# Fill in EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
# EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY, etc.

# 3. Start the dev server
npx expo start
```

The app boots through `chorehero-app/src/App.tsx`, which runs `validateEnv()` at startup. In dev, missing env vars throw immediately. In TestFlight/prod builds they log to the console and the affected feature degrades gracefully (e.g. PaymentScreen guards Stripe).

## Repository layout

```
chorehero-app/                  Expo project root
├── src/
│   ├── screens/                Customer, cleaner, shared, onboarding
│   ├── components/             Shared UI primitives
│   ├── services/               Supabase / Stripe service clients
│   ├── store/                  Zustand stores (cleanerStore today)
│   ├── hooks/                  useAuth and friends
│   ├── navigation/             Stack + tab navigators
│   ├── utils/                  validateEnv, theme, responsive, etc.
│   └── types/                  Shared TypeScript types
├── supabase/
│   ├── migrations/             SQL migrations (numbered)
│   ├── functions/              Edge Functions (create-setup-intent, etc.)
│   └── audit/                  Optional ops scripts (e.g. RLS audit)
└── __tests__/                  Jest service tests
```

## Supabase

The schema lives in `chorehero-app/supabase/migrations`. Apply migrations against your project before running the app — the DB has many `cleaner_profiles`, `customer_profiles`, `bookings`, `jobs`, `quotes`, `content_posts`, `payment_methods`, and `notifications` tables that the client expects. Several Edge Functions (e.g. `create-setup-intent`, `finalize-setup-intent`, `process-refund`, `notify-founder-sms`, `send-push`) need to be deployed and have their secrets set (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

For local Stripe webhook testing:

```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

## Tests

```bash
cd chorehero-app
npm test
```

Service-level integration tests live in `chorehero-app/__tests__/services/`. The smoke checklist for critical flows lives in `chorehero-app/docs/SMOKE_CHECKLIST.md` — run it manually against TestFlight before any release.

## Conventions

- See `CLAUDE.md` for the project's coding conventions, code-structure rules, and AI assistant guidelines.
- Theme split: customer surfaces use teal (`#26B7C9`), cleaner surfaces use orange (`#FFA52F`). Don't mix them in the same UI.
- Service methods that mutate (createBooking, createJob, acceptBooking, etc.) carry an in-flight lock to prevent double-tap double-submits — keep that pattern when adding new mutations.

## Production checklist

Before pushing a TestFlight build:

1. `validateEnv()` passes locally (no missing keys)
2. RLS audit (`chorehero-app/supabase/audit/rls_audit.sql`) shows every `public.*` table protected
3. Smoke checklist in `chorehero-app/docs/SMOKE_CHECKLIST.md` is green
4. Edge Function secrets (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) deployed to the Supabase project
5. EAS env vars (`EXPO_PUBLIC_*`) set on the build profile
6. Google Places API key restriction is set to **iOS app — bundle id `com.chorehero.app`**, NOT HTTP referrer (HTTP referrer restrictions are rejected by mobile clients with the error "API keys with referer restrictions cannot be used with this API")
7. Google Cloud project has both **Places API** and **Places API (New)** enabled, plus **Geocoding API**
8. All required Edge Functions are deployed (`create-setup-intent`, `finalize-setup-intent`, `create-stripe-connect-link`, `get-stripe-connect-status`, `process-payouts`, `process-refund`, `send-push`, `notify-founder-sms`, etc.)

### Edge Function secrets

| Secret | Required by | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | All Stripe functions | Use restricted key in production |
| `SUPABASE_URL` | All functions | Auto-set by Supabase |
| `SUPABASE_ANON_KEY` | All functions | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions that bypass RLS | Required for `create-setup-intent`, `finalize-setup-intent`, `create-stripe-connect-link`, `get-stripe-connect-status`, `process-payouts`, `delete-account` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | Required for signature verification |

## License

Proprietary — ChoreHero, all rights reserved.
