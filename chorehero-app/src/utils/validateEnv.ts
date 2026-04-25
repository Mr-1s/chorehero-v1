/**
 * Boot-time environment validation.
 *
 * Goal: catch missing EAS / .env config before the app falls over deeper in the
 * stack with a confusing "Network request failed" or "Stripe not configured."
 *
 * Behavior:
 * - In dev (`__DEV__`): throw — surfaces immediately in red-box and Metro logs.
 * - In prod (TestFlight / App Store): log a clear console.error and report
 *   missing keys via the returned object so the caller can decide whether to
 *   show a banner. We intentionally do NOT throw in prod to avoid bricking the
 *   app on a single missing optional integration.
 */

type EnvKey =
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  | 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY';

const REQUIRED_KEYS: EnvKey[] = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
];

export interface EnvValidationResult {
  ok: boolean;
  missing: EnvKey[];
}

/**
 * Validate required environment variables. Call once at app boot.
 * Returns a result so the caller (App.tsx) can render a one-time banner in
 * production builds without crashing.
 */
export function validateEnv(): EnvValidationResult {
  const missing = REQUIRED_KEYS.filter((key) => {
    const value = process.env[key];
    return value === undefined || value === null || String(value).trim() === '';
  });

  if (missing.length === 0) {
    return { ok: true, missing: [] };
  }

  const message =
    `Missing required environment variables: ${missing.join(', ')}.\n` +
    'Set them in .env (dev) or EAS Secrets (TestFlight / production).';

  if (__DEV__) {
    // Throw in dev so the developer sees this immediately.
    throw new Error(message);
  }

  // Don't crash production builds on a single missing key — log loudly and
  // let the UI degrade gracefully (e.g. PaymentScreen already guards Stripe).
  console.error('[validateEnv]', message);
  return { ok: false, missing };
}
