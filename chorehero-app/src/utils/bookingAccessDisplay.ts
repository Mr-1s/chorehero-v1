import type { Booking } from '../types/cleaner';

const QUOTE_PLACEHOLDER_PREFIX = 'Job from quote';

/**
 * Pro-facing copy for the Access Instructions / special-request line.
 * Hides the internal "Job from quote - {uuid}" placeholder and prefers real access notes.
 */
export function getProAccessInstructionsLine(booking: Pick<Booking, 'accessInstructions' | 'specialRequestText'>): string {
  const access = booking.accessInstructions?.trim();
  if (access) return access;
  const sp = booking.specialRequestText?.trim() ?? '';
  if (sp.startsWith(QUOTE_PLACEHOLDER_PREFIX)) {
    return 'Booked from your video quote. Use the address above and message the customer for gate codes, parking, or entry.';
  }
  if (sp) return sp;
  return 'No access notes on file. Message the customer if you need entry details.';
}
