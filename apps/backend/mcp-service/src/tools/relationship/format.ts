import { z } from 'zod';
import type { Plan } from '../../schemas';

/** Wording and schemas the relationship tools share. */

/** Separators on the aggregate counts: "2089 entries" is a number to decode, not read. */
export const count = (value: number): string => value.toLocaleString('en-US');

/**
 * One entry, on one line, with the id needed to act on it.
 *
 * The id is shown rather than hidden because editing has to start somewhere: a
 * model that cannot name an entry can only rewrite the whole day, which is what
 * it was reduced to doing before `edit_activity` existed. Type *names* are still
 * resolved for the model — it should never have to invent one of those — but an
 * id it has just been handed is something it can copy back accurately.
 */
export const describeActivity = (
  activity: { _id: string; date: string; description?: string; hours?: number },
  typeName: string
): string => {
  const day = activity.date.slice(0, 10);
  const time = activity.hours !== undefined ? ` (${activity.hours}h)` : '';
  const detail = activity.description ? ` — ${activity.description}` : '';
  return `- ${day}: ${typeName}${time}${detail}  [id ${activity._id}]`;
};

/** "1 hour before", for a plan's line; all-day plans count from 09:00. */
export const reminderText = (plan: Pick<Plan, 'remindBefore' | 'time'>): string => {
  const minutes = plan.remindBefore;
  if (minutes === null) return 'no reminder';
  if (!plan.time) {
    if (minutes === 0) return 'reminder that morning at 09:00';
    if (minutes === 1440) return 'reminder the day before at 09:00';
  }
  if (minutes % 1440 === 0) return `reminder ${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`;
  if (minutes % 60 === 0) return `reminder ${minutes / 60} hour${minutes === 60 ? '' : 's'} before`;
  return `reminder ${minutes} minutes before`;
};

/** One plan, on one line, with the id needed to change it. */
export const describePlan = (plan: Plan): string => {
  const when = plan.endDate ? `${plan.date} to ${plan.endDate}` : plan.date;
  const time = plan.time ? ` ${plan.time}` : plan.endDate ? '' : ' (all day)';
  const place = plan.location ? ` at ${plan.location.label}` : '';
  const logged = plan.loggedActivityId ? ', logged in the journal' : '';
  return `- ${when}${time}: ${plan.title}${place} (${reminderText(plan)}${logged})  [id ${plan._id}]`;
};

/**
 * Today in Tallinn when the model did not say. Not the UTC date, which is still
 * yesterday until 03:00 there and would list a plan that is already over.
 */
export const tallinnToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );

/** HH:mm, 24-hour, as the journal stores a plan's time. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:mm, like 19:00');

export const remindSchema = z
  .number()
  .int()
  .min(0)
  .max(43_200)
  .nullable()
  .describe(
    'Minutes before the start to remind everyone in the journal’s chat, or null for none. ' +
      'An all-day plan counts from 09:00 on its day, so 0 is that morning and 1440 the day before. ' +
      'Leave out for the usual: 60 for a timed plan, 0 for an all-day one.'
  );
