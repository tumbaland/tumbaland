import { dayLabel } from './DaySeparator';

/**
 * 24-hour HH:mm, whatever the browser's language. A phone set to English
 * would otherwise show "02:05 PM", which is not how anyone here reads a clock.
 */
export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/**
 * When someone was last around, for the chat header: "Active now", then
 * "Last active 5 min ago" within the hour, and a clock time after that
 * ("Last active today at 14:05", "yesterday at 21:30", "Monday at 09:12",
 * "on 3 September at 18:40"). Null for someone never seen.
 */
export function activeLabel(online: boolean, lastActiveAt: string | null, now: Date = new Date()): string | null {
  if (online) return 'Active now';
  if (!lastActiveAt) return null;

  const minutes = Math.round((now.getTime() - new Date(lastActiveAt).getTime()) / 60_000);
  if (minutes < 1) return 'Last active just now';
  if (minutes < 60) return `Last active ${minutes} min ago`;

  const day = dayLabel(lastActiveAt, now);
  const time = clockTime(lastActiveAt);
  if (day === 'Today') return `Last active today at ${time}`;
  if (day === 'Yesterday') return `Last active yesterday at ${time}`;
  // A weekday inside the week reads on its own; a date needs "on".
  const weekday = new Date(lastActiveAt).toLocaleDateString(undefined, { weekday: 'long' });
  return day === weekday ? `Last active ${day} at ${time}` : `Last active on ${day} at ${time}`;
}

/** "14:05" today, "Yesterday 14:05" or "Monday 14:05" otherwise. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const day = dayLabel(iso, now);
  return day === 'Today' ? clockTime(iso) : `${day} ${clockTime(iso)}`;
}
