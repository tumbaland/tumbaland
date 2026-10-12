/** A wall-clock time as the API writes it: 24-hour HH:mm. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Where a plan without a zone is assumed to be. Every client sends its own, so
 * this only covers a caller that sends none, like an assistant that was not
 * told; the people using this live in Estonia.
 */
export const DEFAULT_TIME_ZONE = 'Europe/Tallinn';

/** Whether Intl knows this IANA zone name. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock fields of an instant in a zone. */
export function zonedParts(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value])
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    utcMs: Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  };
}

/** How far a zone is ahead of UTC at an instant, in ms. */
const offsetAt = (instant: number, timeZone: string): number =>
  zonedParts(new Date(instant), timeZone).utcMs - Math.floor(instant / 1000) * 1000;

/**
 * The instant a wall-clock time on a day is in a zone: 19:00 on 2026-10-16 in
 * Tallinn is 16:00 UTC. The offset is read at a first guess and then again at
 * the answer, which is what gets the days a clock changes right. A time that
 * does not exist (skipped by the spring change) lands an hour later, the way a
 * phone's clock app treats it.
 */
export function zonedTimeToUtc(day: string, time: string, timeZone: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year!, month! - 1, date!, hour!, minute!);
  const first = wall - offsetAt(wall, timeZone);
  const second = wall - offsetAt(first, timeZone);
  return new Date(second);
}

/**
 * Today as YYYY-MM-DD where the people are, not in UTC. The server runs in UTC,
 * and for the first two or three hours of every Tallinn day the UTC date is
 * still yesterday's, so an entry logged at 01:00 read as "in the future" and
 * was left out of streaks and trends until morning.
 */
export const todayIn = (now: Date = new Date(), timeZone: string = DEFAULT_TIME_ZONE): string =>
  zonedParts(now, timeZone).day;
