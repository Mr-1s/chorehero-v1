/**
 * Opt-in error handling utilities.
 *
 * Goals:
 *   - Standardize the way Supabase / network errors are turned into
 *     user-facing strings (instead of leaking PostgREST jargon to the UI).
 *   - Provide one place to plug in remote logging (Sentry, Datadog, etc.)
 *     later without touching every call site.
 *
 * Non-goals:
 *   - This file does NOT wrap services automatically. Use it per-call where
 *     the readability win is worth it. Blanket-wrapping every service method
 *     hides real errors during the current stabilization phase.
 */

export interface NormalizedError {
  /** Short, user-facing message safe to show in an Alert / toast. */
  message: string;
  /** Original error code (Supabase / Stripe), if any. */
  code?: string;
  /** Untouched error message for logs. */
  raw: string;
}

/** Heuristic: is this a transient network error we should retry / soften? */
export function isLikelyNetworkError(err: unknown): boolean {
  const msg = errorToString(err);
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('timeout') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('AbortError')
  );
}

/** Heuristic: is this an auth-token problem (refresh token expired / missing)? */
export function isAuthTokenError(err: unknown): boolean {
  const msg = errorToString(err);
  return (
    msg.includes('Invalid Refresh Token') ||
    msg.includes('Refresh Token Not Found') ||
    msg.includes('JWT expired') ||
    msg.includes('Auth session missing')
  );
}

/**
 * Map a raw Supabase / Stripe / fetch error to a user-facing string.
 * Keep messages short and actionable. Always preserve the raw message
 * via {@link NormalizedError.raw} for logs.
 */
export function mapSupabaseError(err: unknown): NormalizedError {
  const raw = errorToString(err);
  const code = extractCode(err);

  if (isLikelyNetworkError(err)) {
    return {
      message: 'Network is unavailable. Please check your connection and try again.',
      code,
      raw,
    };
  }
  if (isAuthTokenError(err)) {
    return {
      message: 'Your session expired. Please sign in again.',
      code,
      raw,
    };
  }
  // Schema drift (column missing) — this is on us, not on the user.
  if (/schema cache|could not find.*column|does not exist/i.test(raw)) {
    return {
      message: "We couldn't save that right now. Please try again, or contact support if it continues.",
      code,
      raw,
    };
  }
  // RLS denial.
  if (code === '42501' || /permission denied|row.level security|RLS/i.test(raw)) {
    return {
      message: 'You do not have permission to do that.',
      code,
      raw,
    };
  }
  // Unique constraint (e.g. phone already taken).
  if (code === '23505' || /duplicate key|unique constraint/i.test(raw)) {
    return {
      message: 'That value is already in use. Try a different one.',
      code,
      raw,
    };
  }

  return {
    message: raw || 'Something went wrong. Please try again.',
    code,
    raw,
  };
}

/**
 * Wrap an async function so its thrown / rejected errors get logged with a
 * scope label (and, in the future, forwarded to a remote logger). The wrapped
 * function still throws — this is logging, not swallowing.
 *
 * Usage:
 *   const safeCreate = withErrorLogging(createJob, 'jobQuoteService.createJob');
 */
export function withErrorLogging<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  scope: string
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args);
    } catch (err) {
      const normalized = mapSupabaseError(err);
      // Hook here for Sentry / Datadog later.
      console.error(`[${scope}]`, normalized.raw, { code: normalized.code });
      throw err;
    }
  };
}

// ---- internals ----------------------------------------------------------

function errorToString(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const e = err as { message?: string; error_description?: string };
    return e.message || e.error_description || JSON.stringify(err);
  }
  return String(err);
}

function extractCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === 'string') return c;
    if (typeof c === 'number') return String(c);
  }
  return undefined;
}
