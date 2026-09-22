import { dayLabel } from './DaySeparator';

/**
 * 24-hour HH:mm, whatever the browser's language. A phone set to English
 * would otherwise show "02:05 PM", which is not how anyone here reads a clock.
 */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * "Active now", "Active 5 min ago", "Active 3 h ago", "Active yesterday",
 * "Active on Monday". Null for someone never seen.
 */
export function activeLabel(online: boolean, lastActiveAt: string | null, now: Date = new Date()): string | null {
  if (online) return 'Active now';
  if (!lastActiveAt) return null;

  const minutes = Math.max(1, Math.round((now.getTime() - new Date(lastActiveAt).getTime()) / 60_000));
  if (minutes < 60) return `Active ${minutes} min ago`;
  if (minutes < 24 * 60) return `Active ${Math.round(minutes / 60)} h ago`;

  const day = dayLabel(lastActiveAt, now);
  return day === 'Yesterday' ? 'Active yesterday' : `Active on ${day}`;
}

/** "14:05" today, "Yesterday 14:05" or "Monday 14:05" otherwise. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const day = dayLabel(iso, now);
  return day === 'Today' ? clockTime(iso) : `${day} ${clockTime(iso)}`;
}
