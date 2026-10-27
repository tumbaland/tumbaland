import { Schema, model, models, Document, Model } from 'mongoose';
import type { ActivityModule, ActivityPlatform } from './modules';

/**
 * One person's use of the app on one UTC day.
 *
 * A counter, not a log: a visit is one `$inc` on a document that already
 * exists, so the collection grows by one small row per active person per day
 * and never by the number of clicks. That is what makes keeping it forever
 * reasonable — there is no TTL, unlike `audit_events`, because it holds no
 * content, only which days someone came and which pages they opened.
 *
 * Days are UTC, like the usage meters, so "today" means the same thing in every
 * service and does not depend on where the server happens to run.
 */
export interface IUserDay extends Document {
  userId: string;
  /** `YYYY-MM-DD`, UTC. */
  day: string;
  /** Times the app was opened or came back after a long absence (see shell-front's activity hook). */
  visits: number;
  /** Opens per page, keyed by `ActivityModule`. */
  modules: Partial<Record<ActivityModule, number>>;
  /** Visits per kind of device. */
  platform: Partial<Record<ActivityPlatform, number>>;
  /** Cloudflare's CF-IPCountry at the last visit that day. */
  country?: string;
  firstAt: Date;
  lastAt: Date;
  /**
   * Written by the one-off backfill from the audit trail, not by a visit.
   * Such a day knows only that the person wrote something, so it undercounts,
   * and the admin screens say so wherever they show one.
   */
  backfilled?: boolean;
}

const UserDaySchema = new Schema<IUserDay>(
  {
    userId: { type: String, required: true },
    day: { type: String, required: true },
    visits: { type: Number, default: 0 },
    modules: { type: Schema.Types.Mixed, default: undefined },
    platform: {
      web: { type: Number },
      pwa: { type: Number },
      ios: { type: Number },
      android: { type: Number }
    },
    country: { type: String, maxlength: 2 },
    firstAt: { type: Date, required: true },
    lastAt: { type: Date, required: true },
    backfilled: { type: Boolean }
  },
  { collection: 'user_days', minimize: true }
);

// A person's days, and one day across everybody ("who was here on the 3rd").
UserDaySchema.index({ userId: 1, day: 1 }, { unique: true });
UserDaySchema.index({ day: 1 });

/**
 * Registered through `models` first: several services import this module into
 * the same mongoose singleton during tests, and a second `model()` call with
 * the same name throws `OverwriteModelError`.
 */
export const UserDay: Model<IUserDay> =
  (models.UserDay as Model<IUserDay>) || model<IUserDay>('UserDay', UserDaySchema);
