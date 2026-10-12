import mongoose from 'mongoose';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@tumbaland/backend-core';
import { Plan, IPlan } from '../models/Plan';
import { Activity, IActivityLocation } from '../models/Activity';
import { ActivityType, IActivityType } from '../models/ActivityType';
import { isTypeAccessible } from './activity.service';
import { scopeQuery } from './day.service';
import { DEFAULT_TIME_ZONE, todayIn, zonedTimeToUtc } from '../utils/time';

/** All-day plans are reminded about from this time on their day (or before it). */
export const ALL_DAY_REMINDER_TIME = '09:00';

/** What a new plan is reminded with when the caller does not say. */
export const DEFAULT_REMIND_BEFORE = { timed: 60, allDay: 0 };

export interface PlanInput {
  title: string;
  /** UTC midnight of the day, as the validator parses it */
  date: Date;
  time?: string | null;
  timeZone?: string;
  notes?: string;
  typeId?: string | null;
  location?: IActivityLocation | null;
  remindBefore?: number | null;
  groupId?: string;
}

/** A plan as the API returns it: the day as YYYY-MM-DD, its type populated. */
export interface PlanView {
  _id: string;
  id: string;
  title: string;
  date: string;
  time: string | null;
  timeZone: string;
  startsAt: Date;
  notes?: string;
  typeId: string | null;
  type?: IActivityType;
  location: IActivityLocation | null;
  remindBefore: number | null;
  remindAt: Date | null;
  remindedAt: Date | null;
  loggedActivityId: string | null;
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

export function toPlanView(plan: IPlan): PlanView {
  const raw = plan.toObject() as Record<string, unknown> & IPlan;
  const populated = raw.typeId as unknown as (IActivityType & { _id: mongoose.Types.ObjectId }) | null;
  const isPopulated = !!populated && typeof populated === 'object' && 'name' in populated;
  return {
    _id: String(raw._id),
    id: String(raw._id),
    title: raw.title,
    date: dayKey(raw.date),
    time: raw.time ?? null,
    timeZone: raw.timeZone,
    startsAt: raw.startsAt,
    ...(raw.notes ? { notes: raw.notes } : {}),
    typeId: populated ? String(isPopulated ? populated._id : populated) : null,
    ...(isPopulated ? { type: populated } : {}),
    location: raw.location ?? null,
    remindBefore: raw.remindBefore ?? null,
    remindAt: raw.remindAt ?? null,
    remindedAt: raw.remindedAt ?? null,
    loggedActivityId: raw.loggedActivityId ? String(raw.loggedActivityId) : null,
    userId: raw.userId,
    ...(raw.groupId ? { groupId: raw.groupId } : {}),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

/**
 * The fields derived from a plan's day, time and reminder: when it starts, and
 * when (if ever) the group is reminded. A reminder whose time has already
 * passed is marked as done rather than left pending, so making a plan for
 * twenty minutes from now does not buzz everyone at once with "in an hour".
 */
export function scheduleFields(
  plan: { date: Date; time?: string | null; timeZone: string; remindBefore?: number | null },
  now: Date = new Date()
): { startsAt: Date; remindAt: Date | null; remindedAt: Date | null } {
  const day = dayKey(plan.date);
  const startsAt = zonedTimeToUtc(day, plan.time || '00:00', plan.timeZone);
  if (plan.remindBefore === null || plan.remindBefore === undefined) {
    return { startsAt, remindAt: null, remindedAt: null };
  }
  const anchor = plan.time ? startsAt : zonedTimeToUtc(day, ALL_DAY_REMINDER_TIME, plan.timeZone);
  const remindAt = new Date(anchor.getTime() - plan.remindBefore * 60_000);
  return { startsAt, remindAt, remindedAt: remindAt > now ? null : now };
}

/** Plans this caller may read or change: their own personal ones and their groups'. */
const reachableBy = (userId: string, userGroupIds: string[]) => ({
  $or: [{ userId, groupId: null }, { groupId: { $in: userGroupIds } }]
});

async function assertType(
  typeId: string | null | undefined,
  userId: string,
  userGroupIds: string[],
  groupId?: string
): Promise<void> {
  if (!typeId) return;
  if (!(await isTypeAccessible(typeId, userId, userGroupIds, groupId))) {
    throw new BadRequestError('Invalid or inaccessible activity type');
  }
}

/**
 * Plans in one scope, earliest first, all-day ones ahead of timed ones on the
 * same day. `startDate`/`endDate` bound the days (a calendar month);
 * `upcoming` keeps only the ones not yet logged.
 */
export const listPlans = async (options: {
  userId: string;
  userGroupIds: string[];
  groupId?: string;
  startDate?: Date;
  endDate?: Date;
  upcoming?: boolean;
  limit?: number;
}): Promise<PlanView[]> => {
  const { userId, userGroupIds, groupId, startDate, endDate, upcoming, limit = 100 } = options;
  if (groupId && !userGroupIds.includes(groupId)) throw new ForbiddenError('Access denied');

  const query: Record<string, unknown> = { ...scopeQuery(userId, groupId) };
  if (startDate || endDate) {
    query.date = { ...(startDate ? { $gte: startDate } : {}), ...(endDate ? { $lte: endDate } : {}) };
  }
  if (upcoming) query.loggedActivityId = null;

  const plans = await Plan.find(query)
    .populate('typeId')
    .sort({ date: 1, time: 1, createdAt: 1 })
    .limit(Math.min(Math.max(limit, 1), 200));
  return plans.map(toPlanView);
};

export const createPlan = async (input: PlanInput, userId: string, userGroupIds: string[]): Promise<PlanView> => {
  if (input.groupId && !userGroupIds.includes(input.groupId)) throw new ForbiddenError('Access denied');
  await assertType(input.typeId, userId, userGroupIds, input.groupId);

  const timeZone = input.timeZone || DEFAULT_TIME_ZONE;
  const remindBefore =
    input.remindBefore !== undefined
      ? input.remindBefore
      : input.time
        ? DEFAULT_REMIND_BEFORE.timed
        : DEFAULT_REMIND_BEFORE.allDay;
  const fields = { date: input.date, time: input.time ?? null, timeZone, remindBefore };

  const plan = new Plan({
    title: input.title,
    ...fields,
    ...scheduleFields(fields),
    notes: input.notes,
    typeId: input.typeId || null,
    location: input.location ?? null,
    userId,
    ...(input.groupId ? { groupId: input.groupId } : {})
  });
  await plan.save();
  await plan.populate('typeId');
  return toPlanView(plan);
};

const findReachable = async (id: string, userId: string, userGroupIds: string[]): Promise<IPlan> => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new NotFoundError('Plan not found');
  const plan = await Plan.findOne({ _id: id, ...reachableBy(userId, userGroupIds) });
  if (!plan) throw new NotFoundError('Plan not found');
  return plan;
};

/**
 * Changes a plan. Moving it or changing its reminder schedules the reminder
 * again, so a concert moved from Friday to Saturday is reminded about on
 * Saturday even if Friday's reminder already went.
 */
export const updatePlan = async (
  id: string,
  patch: Partial<Omit<PlanInput, 'groupId'>>,
  userId: string,
  userGroupIds: string[]
): Promise<PlanView> => {
  const plan = await findReachable(id, userId, userGroupIds);
  if (patch.typeId !== undefined) await assertType(patch.typeId, userId, userGroupIds, plan.groupId);

  if (patch.title !== undefined) plan.title = patch.title;
  if (patch.notes !== undefined) plan.notes = patch.notes;
  if (patch.typeId !== undefined) plan.typeId = patch.typeId ? new mongoose.Types.ObjectId(patch.typeId) : null;
  if (patch.location !== undefined) plan.location = patch.location;

  const timing = ['date', 'time', 'timeZone', 'remindBefore'] as const;
  if (timing.some((field) => patch[field] !== undefined)) {
    if (patch.date !== undefined) plan.date = patch.date;
    if (patch.time !== undefined) plan.time = patch.time;
    if (patch.timeZone !== undefined) plan.timeZone = patch.timeZone;
    if (patch.remindBefore !== undefined) plan.remindBefore = patch.remindBefore;
    Object.assign(plan, scheduleFields(plan));
  }

  await plan.save();
  await plan.populate('typeId');
  return toPlanView(plan);
};

/** One plan, for a link to it (a reminder's Open). */
export const getPlan = async (id: string, userId: string, userGroupIds: string[]): Promise<PlanView> => {
  const plan = await findReachable(id, userId, userGroupIds);
  await plan.populate('typeId');
  return toPlanView(plan);
};

export const deletePlan = async (id: string, userId: string, userGroupIds: string[]): Promise<void> => {
  const plan = await findReachable(id, userId, userGroupIds);
  await plan.deleteOne();
};

/**
 * "Log it": turns a plan that happened into a journal entry on its day, in the
 * plan's own scope. The title becomes the description where the type takes
 * one, and the place carries over where the type has places. Once only: a
 * second log of the same plan is refused rather than making a duplicate.
 */
export const logPlan = async (
  id: string,
  typeId: string | undefined,
  userId: string,
  userGroupIds: string[],
  now: Date = new Date()
): Promise<{ plan: PlanView; activityId: string }> => {
  const plan = await findReachable(id, userId, userGroupIds);
  if (plan.loggedActivityId) throw new ConflictError('This plan is already in the journal');
  if (dayKey(plan.date) > todayIn(now, plan.timeZone)) throw new BadRequestError('A plan can be logged once its day has come');

  const chosen = typeId || (plan.typeId ? String(plan.typeId) : undefined);
  if (!chosen) throw new BadRequestError('Choose an activity type to log it as');
  await assertType(chosen, userId, userGroupIds, plan.groupId);
  const type = await ActivityType.findById(chosen);

  const activity = new Activity({
    date: plan.date,
    typeId: chosen,
    ...(type?.valueType === 'string' || !type?.valueType ? { description: plan.title.slice(0, 500) } : {}),
    ...(type?.hasLocation && plan.location ? { location: plan.location } : {}),
    userId,
    ...(plan.groupId ? { groupId: plan.groupId } : {})
  });
  await activity.save();

  plan.loggedActivityId = activity._id as mongoose.Types.ObjectId;
  if (!plan.typeId) plan.typeId = new mongoose.Types.ObjectId(chosen);
  await plan.save();
  await plan.populate('typeId');
  return { plan: toPlanView(plan), activityId: String(activity._id) };
};
