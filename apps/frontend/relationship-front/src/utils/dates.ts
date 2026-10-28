import { todayKey } from '@tumbaland/frontend-core';

export { localDayKey, todayKey } from '@tumbaland/frontend-core';

/** "Today", "Yesterday", or the weekday, for a day card's heading. */
export const dayLabel = (date: string): string => {
  const d = new Date(`${date}T00:00:00`);
  const today = new Date(`${todayKey()}T00:00:00`);
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long' });
};

/** "October 2026": the heading over a month of days. */
export const monthLabel = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric'
  });
