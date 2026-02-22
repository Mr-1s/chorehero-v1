# GitHub Actions + Supabase Setup

To deploy Supabase Edge Functions via GitHub Actions, add these **secrets** to your repo.

## 1. Add GitHub Secrets

**GitHub repo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Where to get it |
|-------------|-----------------|
| `SUPABASE_ACCESS_TOKEN` | [Supabase Dashboard](https://supabase.com/dashboard/account/tokens) → Access Tokens → Generate new token |
| `SUPABASE_PROJECT_REF` | Your project URL: `https://XXXXX.supabase.co` → the `XXXXX` part (e.g. `kluwipcdwaaeqxjmbcti`) |

## 2. Verify

- `SUPABASE_ACCESS_TOKEN`: A long JWT string (starts with `sbp_` or similar)
- `SUPABASE_PROJECT_REF`: 20-character alphanumeric string from your project URL

## 3. Test

Push a change to `chorehero-app/supabase/functions/**` or `.github/workflows/deploy-supabase.yml` to trigger the workflow.
