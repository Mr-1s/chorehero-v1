import type { Booking } from '../types/cleaner';

const QUOTE_LINE =
  /Job from quote - ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Resolves the marketplace `jobs.id` for quote-originated bookings. */
export function resolveQuoteJobIdForBooking(
  b: Pick<Booking, 'quoteJobId' | 'specialRequestText' | 'id'>
): string | null {
  if (b.quoteJobId) return b.quoteJobId;
  const m = b.specialRequestText?.match(QUOTE_LINE);
  return m ? m[1] : null;
}
