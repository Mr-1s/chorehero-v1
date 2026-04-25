# Stripe Secrets Reference

## Where Each Secret Is Used

### 1. Supabase Edge Functions (Supabase Dashboard, not GitHub)

Configure in **Supabase Dashboard** → **Edge Functions** → select function → **Settings** → **Environment Variables**

| Variable | Used By | Purpose |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | create-payment-intent, create-quote-payment-intent, confirm-quote-payment, stripe-webhook, process-payouts, process-refund | Stripe API authentication |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Verify webhook signatures |
| `STRIPE_PLATFORM_FEE_BPS` | create-payment-intent | Platform fee (basis points, e.g. 1900 = 19%) |
| `STRIPE_CUSTOMER_FEE_BPS` | create-payment-intent | Customer fee (basis points, e.g. 900 = 9%) |
| `TEST_MODE` | create-quote-payment-intent, confirm-quote-payment | Set to `"true"` to skip real Stripe calls (returns mock client secret). Use when Stripe keys are not yet configured. |

### 2. GitHub Secrets (for CI workflows)

| Secret | Used By | Purpose |
|--------|---------|---------|
| `STRIPE_TEST_SECRET_KEY` | comprehensive-testing.yml (gap regression) | Stripe test key for automated tests |
| `EXPO_PUBLIC_STRIPE_PK` | (if used by build/deploy) | Publishable key for app builds |

### 3. App (local `.env` or EAS secrets)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Elements in the app (payment UI) |

---

## How to Verify They're Working

### Supabase Functions
1. **Supabase Dashboard** → **Edge Functions** → **create-payment-intent** or **create-quote-payment-intent** → **Logs**
2. Trigger a payment in the app (e.g. Accept & Pay on a quote in QuoteFeedScreen)
3. Check logs for errors (missing env = "STRIPE_SECRET_KEY is not defined")
4. **Quick dev setup:** Set `TEST_MODE=true` on create-quote-payment-intent and confirm-quote-payment to bypass Stripe until keys are configured

### Stripe Webhook
1. **Stripe Dashboard** → **Developers** → **Webhooks**
2. Your webhook URL: `https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook`
3. Send a test event; if secret is wrong, you'll see signature verification errors

### GitHub Workflows
1. **GitHub** → **Actions** → run the workflow
2. If `STRIPE_TEST_SECRET_KEY` is missing, gap-regression tests will fail with env errors
