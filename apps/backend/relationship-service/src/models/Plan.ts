import mongoose, { Schema, Document } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';
import { IActivityLocation } from './Activity';

/**
 * Something coming up: a concert on Friday at 19:00, a weekend away.
 *
 * Kept apart from Activity on purpose. An entry is a record of what happened,
 * and streaks, milestones, stats and the heatmap all count entries; a plan
 * stored as one would count before it happened. A plan becomes an entry only
 * when someone logs it afterwards (`loggedActivityId`).
 */
export interface IPlan extends Document {
  id: string;
  title: string;
  /** The (first) day, stored as its UTC midnight like an entry's date. */
  date: Date;
  /** The last day of a plan that spans several, like a trip. Null for one day. */
  endDate?: Date | null;
  /** 24-hour HH:mm on that day, in `timeZone`. Absent for an all-day plan. */
  time?: string | null;
  /** IANA zone the plan was made in, so 19:00 stays 19:00 across a clock change. */
  timeZone: string;
  /** The instant it starts: `time` on `date` in `timeZone`, or local midnight when all day. */
  startsAt: Date;
  notes?: string;
  /** An activity type, offered when the plan is logged. */
  typeId?: mongoose.Types.ObjectId | null;
  location?: IActivityLocation | null;
  /**
   * Minutes before the start to remind the group, or null for no reminder. An
   * all-day plan counts from 09:00 that day, so 0 is "that morning".
   */
  remindBefore?: number | null;
  /** When the reminder is due. Derived from the fields above on every write. */
  remindAt?: Date | null;
  /** Set when the reminder is claimed; null while one is pending. */
  remindedAt?: Date | null;
  /** The entry made from this plan, once it was logged. */
  loggedActivityId?: mongoose.Types.ObjectId | null;
  userId: string;
  groupId?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlanLocationSchema = new Schema<IActivityLocation>(
  {
    label: { type: String, required: true, trim: true, maxlength: 200 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 }
  },
  { _id: false }
);

const PlanSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    date: { type: Date, required: true },
    endDate: { type: Date, default: null },
    time: { type: String, default: null, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    timeZone: { type: String, required: true },
    startsAt: { type: Date, required: true },
    notes: { type: String, maxlength: 1000 },
    typeId: { type: Schema.Types.ObjectId, ref: 'ActivityType', default: null },
    location: { type: PlanLocationSchema, default: null },
    remindBefore: { type: Number, default: null, min: 0 },
    remindAt: { type: Date, default: null },
    remindedAt: { type: Date, default: null },
    loggedActivityId: { type: Schema.Types.ObjectId, ref: 'Activity', default: null },
    userId: { type: String, required: true },
    groupId: { type: String }
  },
  { timestamps: true, collection: 'plans' }
);

// Scoped reads filter on the tenancy field and then walk the days, as entries do.
// A trip is found by its first day, bounded by the longest a plan may span
// (MAX_PLAN_DAYS), so the range read stays on these indexes.
PlanSchema.index({ groupId: 1, date: 1 });
PlanSchema.index({ userId: 1, date: 1 });
// The reminder sweep: pending ones, earliest first.
PlanSchema.index({ remindedAt: 1, remindAt: 1 });

PlanSchema.plugin(auditPlugin, { resource: 'plan' });

export const Plan = mongoose.model<IPlan>('Plan', PlanSchema);
