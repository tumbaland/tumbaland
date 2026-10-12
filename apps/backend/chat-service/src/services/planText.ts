import type { IPlanCard } from '../models/Message';

/** YYYY-MM-DD in a zone, for "is it today there". */
const dayIn = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);

const addDays = (day: string, days: number): string => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** "Friday 16 October", the plan's own day; no zone arithmetic, it is a calendar day. */
const longDay = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

/** " to Sunday 18 October" for a trip, nothing for one day. */
const until = (plan: Pick<IPlanCard, 'endDate'>): string => (plan.endDate ? ` to ${longDay(plan.endDate)}` : '');

/**
 * When a plan is, as a line in the thread: "on Friday 16 October at 19:00",
 * or "from Friday 16 October to Sunday 18 October" for a trip. Absolute,
 * because the message stays in the history and "tomorrow" would be wrong by
 * the next day.
 */
export function planWhen(plan: Pick<IPlanCard, 'date' | 'endDate' | 'time'>): string {
  const start = `${longDay(plan.date)}${plan.time ? ` at ${plan.time}` : ''}`;
  return plan.endDate ? `from ${start}${until(plan)}` : `on ${start}`;
}

/**
 * When a plan is, for the notification: "today at 19:00", "tomorrow", or the
 * day itself. Relative, since it is read the moment it arrives; worked out in
 * the plan's own zone, so 01:00 in Tallinn is already the next day.
 */
export function planWhenFromNow(
  plan: Pick<IPlanCard, 'date' | 'endDate' | 'time' | 'timeZone'>,
  now: Date = new Date()
): string {
  const today = dayIn(now, plan.timeZone);
  const at = plan.time ? ` at ${plan.time}` : '';
  const from = plan.endDate ? 'from ' : '';
  if (plan.date === today) return `${from}today${at}${until(plan)}`;
  if (plan.date === addDays(today, 1)) return `${from}tomorrow${at}${until(plan)}`;
  return planWhen(plan);
}

/** The thread's text for a reminder: what it is, when, and where. */
export function planReminderText(plan: IPlanCard): string {
  return `${plan.title} ${planWhen(plan)}${plan.place ? ` · ${plan.place}` : ''}`;
}

/** The notification's text for a reminder. */
export function planReminderPush(plan: IPlanCard, now: Date = new Date()): string {
  return `${plan.title} ${planWhenFromNow(plan, now)}${plan.place ? ` · ${plan.place}` : ''}`;
}
