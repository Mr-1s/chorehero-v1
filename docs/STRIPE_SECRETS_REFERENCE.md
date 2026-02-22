# Stripe Secrets Reference

## Where Each Secret Is Used

### 1. Supabase Edge Functions (Supabase Dashboard, not GitHub)

Configure in **Supabase Dashboard** → **Edge Functions** → select function → **Settings** → **Environment Variables**

| Variable | Used By | Purpose |
|----------|---------|---------|
| `STRIPE_SECRET_KEY` | create-payment-intent, stripe-webhook, process-payouts, process-refund | Stripe API authentication |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | Verify webhook signatures |
| `STRIPE_PLATFORM_FEE_BPS` | create-payment-intent | Platform fee (basis points, e.g. 1900 = 19%) |
| `STRIPE_CUSTOMER_FEE_BPS` | create-payment-intent | Customer fee (basis points, e.g. 900 = 9%) |

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
1. **Supabase Dashboard** → **Edge Functions** → **create-payment-intent** → **Logs**
2. Trigger a payment in the app
3. Check logs for errors (missing env = "STRIPE_SECRET_KEY is not defined")

### Stripe Webhook
1. **Stripe Dashboard** → **Developers** → **Webhooks**
2. Your webhook URL: `https://[PROJECT_REF].supabase.co/functions/v1/stripe-webhook`
3. Send a test event; if secret is wrong, you'll see signature verification errors

### GitHub Workflows
1. **GitHub** → **Actions** → run the workflow
2. If `STRIPE_TEST_SECRET_KEY` is missing, gap-regression tests will fail with env errors
