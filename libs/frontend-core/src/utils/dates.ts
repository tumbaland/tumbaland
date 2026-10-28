const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A day as YYYY-MM-DD in the browser's own time zone.
 *
 * Not `toISOString().slice(0, 10)`, which is the UTC day: in Tallinn that is
 * still yesterday until 03:00 in summer (02:00 in winter), so "today" was the
 * day before and a date picker would not let you pick the real today.
 */
export const localDayKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Today in the browser's time zone, as YYYY-MM-DD. */
export const todayKey = (): string => localDayKey();

/**
 * A YYYY-MM-DD day written for the reader's locale, e.g. "Oct 13, 2026".
 *
 * Parsed as local midnight so the day never shifts with the time zone, and
 * `options` picks the shape: `{ month: 'short', day: 'numeric' }` for a row,
 * `{ year: 'numeric', month: 'long', day: 'numeric' }` for a heading.
 */
export const formatDay = (
  day: string,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
): string => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, options);
