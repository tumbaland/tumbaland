const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A day as YYYY-MM-DD in the browser's own time zone.
 *
 * Not `toISOString().slice(0, 10)`, which is the UTC day: in Tallinn that is
 * still yesterday until 03:00 in summer (02:00 in winter), so "today" in the
 * journal was the day before and the date picker would not let you pick the
 * real today.
 */
export const localDayKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Today in the browser's time zone, as YYYY-MM-DD. */
export const todayKey = (): string => localDayKey();
