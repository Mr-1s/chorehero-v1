/**
 * App configuration - feature flags and environment.
 */

/**
 * When true, feed uses demo/sample posts when real content is sparse (<5) or load fails.
 * Set EXPO_PUBLIC_DEMO_MODE=true only for curated demo content; off by default in dev and prod.
 */
export const FEATURE_DEMO_FALLBACK = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

/** Comma-separated admin emails for AdminDashboard access. */
const ADMIN_EMAILS_RAW = process.env.EXPO_PUBLIC_ADMIN_EMAILS || '';
export const ADMIN_EMAILS = ADMIN_EMAILS_RAW
  ? ADMIN_EMAILS_RAW.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [];

