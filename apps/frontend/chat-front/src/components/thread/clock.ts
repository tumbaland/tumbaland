import { dayLabel } from './DaySeparator';

/**
 * 24-hour HH:mm, whatever the browser's language. A phone set to English
 * would otherwise show "02:05 PM", which is not how anyone here reads a clock.
 */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "14:05" today, "Yesterday 14:05" or "Monday 14:05" otherwise. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const day = dayLabel(iso, now);
  return day === 'Today' ? clockTime(iso) : `${day} ${clockTime(iso)}`;
}
