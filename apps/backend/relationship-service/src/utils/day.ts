/** A calendar day as the API writes it. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The UTC midnight a YYYY-MM-DD day is stored as, or null if the day does not
 * exist. `new Date` parses 2026-02-31 without complaint as the day it rolls
 * over to (3 March), so the round trip is what catches it.
 */
export function parseDay(day: string): Date | null {
  if (!DAY_PATTERN.test(day)) return null;
  const date = new Date(`${day}T00:00:00.000Z`);
  if (isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return null;
  return date;
}
