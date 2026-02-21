/**
 * Timezone utilities for ChoreHero.
 *
 * All times are stored as UTC in the database (TIMESTAMPTZ).
 * These helpers convert to/from a viewer's local IANA timezone for display.
 *
 * We avoid a heavy dependency (date-fns-tz) and use the built-in
 * Intl.DateTimeFormat API which is available in Hermes / JavaScriptCore.
 */

export const DEFAULT_TZ = 'America/New_York';

/**
 * Format a UTC ISO string for display in the viewer's timezone.
 *
 * @param utcIso    - ISO 8601 timestamp from the database (UTC)
 * @param timezone  - IANA timezone string, e.g. 'America/Los_Angeles'
 * @param options   - Intl.DateTimeFormat options (defaults to readable date+time)
 *
 * @example
 *   displayInTz('2026-01-25T14:00:00Z', 'America/Chicago')
 *   // → "Jan 25, 8:00 AM CST"
 */
export function displayInTz(
  utcIso: string,
  timezone: string = DEFAULT_TZ,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const date = new Date(utcIso);
    const fmt = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
      timeZone: timezone,
      ...options,
    });
    return fmt.format(date);
  } catch {
    // Fallback if timezone is invalid
    return new Date(utcIso).toLocaleString();
  }
}

/**
 * Format just the time portion in the viewer's timezone.
 */
export function displayTimeInTz(
  utcIso: string,
  timezone: string = DEFAULT_TZ
): string {
  return displayInTz(utcIso, timezone, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Format just the date portion in the viewer's timezone.
 */
export function displayDateInTz(
  utcIso: string,
  timezone: string = DEFAULT_TZ
): string {
  return displayInTz(utcIso, timezone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Get the device's current IANA timezone.
 * Falls back to DEFAULT_TZ if unavailable.
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

/**
 * Convert a local date and time to a UTC ISO string for database storage.
 *
 * @param dateStr   - Date string in 'YYYY-MM-DD' format
 * @param timeStr   - Time string in 'HH:MM' 24h format
 * @param timezone  - Source IANA timezone
 */
export function localToUtcIso(
  dateStr: string,
  timeStr: string,
  timezone: string = DEFAULT_TZ
): string {
  // Build a naive local string and parse it as if it were UTC offset-adjusted.
  // Intl doesn't expose offset directly, so we use a round-trip approach.
  const naiveIso = `${dateStr}T${timeStr}:00`;

  // Get the UTC offset for this timezone at this moment using Intl
  const testDate = new Date(naiveIso);
  const localStr = testDate.toLocaleString('sv-SE', { timeZone: timezone }); // 'sv-SE' gives YYYY-MM-DD HH:MM:SS
  const utcStr = testDate.toLocaleString('sv-SE', { timeZone: 'UTC' });

  const offsetMs =
    new Date(localStr.replace(' ', 'T')).getTime() -
    new Date(utcStr.replace(' ', 'T')).getTime();

  return new Date(testDate.getTime() - offsetMs).toISOString();
}
