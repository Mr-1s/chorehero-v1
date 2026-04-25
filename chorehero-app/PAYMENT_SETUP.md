# Payment Setup (Quote & Booking)

Quote payment uses Supabase Edge Functions. Real Stripe flow: create-quote-payment-intent → Stripe PaymentSheet → confirm-quote-payment.

## Option A: Fake Payment (local dev)

Add to `chorehero-app/.env`:

```
EXPO_PUBLIC_USE_FAKE_PAYMENT=true
```

QuoteAcceptScreen will insert a booking directly without calling Stripe. No Edge Function deployment needed.

## Option B: Real Stripe (production)

### 1. Deploy Edge Functions

```bash
cd chorehero-app
supabase functions deploy create-quote-payment-intent
supabase functions deploy confirm-quote-payment
```

### 2. Set Edge Function Secrets

In **Supabase Dashboard** → **Project Settings** → **Edge Functions** → **Secrets**, add:

| Secret | Value |
|--------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` |

### 3. Client .env

```
EXPO_PUBLIC_USE_FAKE_PAYMENT=false
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Flow

1. Customer: My Jobs → tap job → QuoteListScreen (quotes)
2. Tap "Accept & Pay" → QuoteAcceptScreen
3. Real path: create-quote-payment-intent → presentPaymentSheet → confirm-quote-payment → BookingConfirmedScreen
4. Fake path: insert booking directly → BookingConfirmedScreen

## Troubleshooting

- **"Payment setup timed out"** – Ensure Edge Functions are deployed and STRIPE_SECRET_KEY is set. Or use EXPO_PUBLIC_USE_FAKE_PAYMENT=true for local dev.
- **"Stripe not configured"** – Add STRIPE_SECRET_KEY in Edge Function secrets.
- **Cold start** – First payment after deploy can take 10–20 seconds; retry if it times out.
