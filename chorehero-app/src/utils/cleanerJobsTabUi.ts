import type { JobTab } from '../types/cleaner';

/**
 * **Policy:** The compact "Today's job" callout (tap → job + quotes, same as customer `QuoteList` in
 * pro mode) lives **only** on the **Quotes** tab. Do not show on Booked/Requests/History — Booked
 * already lists job cards and receipts. When adding new hero UI above the Jobs list, use this
 * helper (or document a deliberate exception at the call site).
 */
export function shouldShowTodaysJobCallout(tab: JobTab): boolean {
  return tab === 'quotes';
}
