/**
 * Days are `YYYY-MM-DD` strings in UTC everywhere in this service, because that
 * is how `user_days` stores them, and string comparison on that format is date
 * comparison. Doing the arithmetic on the strings keeps a server's local
 * timezone out of it entirely.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const toDay = (at: Date): string => at.toISOString().slice(0, 10);

const parseDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** `day` moved by `days` (negative goes back). */
export const shiftDay = (day: string, days: number): string => toDay(new Date(parseDay(day).getTime() + days * DAY_MS));

/** Every day from `from` to `to`, both included. */
export const daysBetween = (from: string, to: string): string[] => {
  const days: string[] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) days.push(day);
  return days;
};

/** The Monday on or before `day`, which is where `$dateTrunc` puts a week with `startOfWeek: 'monday'`. */
export const weekStart = (day: string): string => {
  const weekday = parseDay(day).getUTCDay(); // 0 is Sunday
  return shiftDay(day, -((weekday + 6) % 7));
};

/** Whole weeks from the Monday `from` to the day `day`. */
export const weeksBetween = (from: string, day: string): number =>
  Math.floor((parseDay(day).getTime() - parseDay(from).getTime()) / (7 * DAY_MS));

/** The first day of the month `at` is in. */
export const monthStart = (at: Date): Date => new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));

/** The instant a day starts, for comparing with a timestamp. */
export const startOfDay = (day: string): Date => parseDay(day);
