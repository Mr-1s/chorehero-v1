# Stripe Setup Guide

This guide ensures Stripe is wired correctly for the ChoreHero app, including the **quote-to-booking payment flow** (Accept & Pay on QuoteFeedScreen).

## 1. Deploy Edge Functions

The quote payment flow uses two Edge Functions that must be deployed:

- `create-quote-payment-intent` – creates a Stripe PaymentIntent when customer taps "Accept & Pay"
- `confirm-quote-payment` – creates the booking after payment succeeds

**Deploy via GitHub Actions** (on push to `main` when `chorehero-app/supabase/functions/**` changes):

```bash
# Or deploy manually:
cd chorehero-app
supabase functions deploy create-quote-payment-intent --project-ref YOUR_PROJECT_REF
supabase functions deploy confirm-quote-payment --project-ref YOUR_PROJECT_REF
```

## 2. Configure Supabase Edge Function Secrets

In **Supabase Dashboard** → **Edge Functions** → select each function → **Settings** → **Environment Variables**:

| Variable | create-quote-payment-intent | confirm-quote-payment | Required |
|----------|-----------------------------|------------------------|----------|
| `STRIPE_SECRET_KEY` | ✅ | ✅ | Yes (for real payments) |
| `TEST_MODE` | ✅ | ✅ | Optional – set to `"true"` to skip Stripe when keys aren't ready |

**Development without Stripe keys:** Set `TEST_MODE=true` on both functions. The app will use mock payment intents and complete the flow without real Stripe calls.

## 3. Configure App (chorehero-app/.env)

```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
```

Get this from [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → **Developers** → **API keys** → **Publishable key**.

**Note:** When `TEST_MODE=true` on the Edge Functions, the app still needs a valid publishable key for Stripe React Native to initialize. Use your Stripe test key.

## 4. Verify the Flow

1. **Post a job** (customer) → **Send a video quote** (pro)
2. **Accept & Pay** on the quote (customer)
3. If `TEST_MODE=true`: payment completes immediately with a mock flow
4. If `TEST_MODE=false`: Stripe Payment Sheet appears; complete with test card `4242 4242 4242 4242`

**Check logs:** Supabase Dashboard → Edge Functions → `create-quote-payment-intent` → Logs. Look for errors such as `STRIPE_SECRET_KEY is not defined` if keys are missing.

## 5. Common Errors

| Error | Cause | Fix |
|------|-------|-----|
| `Edge Function returned a non-2xx status code` | Function not deployed, or function threw (e.g. missing STRIPE_SECRET_KEY) | Deploy functions; set `STRIPE_SECRET_KEY` or `TEST_MODE=true` |
| `Quote not found` | Invalid quote_id or RLS | Ensure quote exists and user is the job customer |
| `Payment not verified` | Stripe PaymentIntent not succeeded | Complete payment in Stripe sheet; in TEST_MODE use mock flow |
| `Amount too small (min $0.50)` | Quote price &lt; 50¢ | Quote must be at least $0.50 |

## 6. Full Stripe Reference

See [STRIPE_SECRETS_REFERENCE.md](./STRIPE_SECRETS_REFERENCE.md) for all Stripe-related env vars across the app.
