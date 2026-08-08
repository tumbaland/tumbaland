import { Schema, model, models, Document, Model } from 'mongoose';
import { MeterKey, MeterPeriod, meterPeriod } from './definitions';

/**
 * One counter per (subject, meter, period). Lives in the shared database, so
 * album-service can write `storageBytes` while payment-service reads it back
 * for the pricing page without another round trip.
 *
 * `subjectId` is whoever the usage is billed to — an email for personal
 * meters, the group owner's email for pooled ones. It is deliberately not a
 * user ObjectId: every service already has the email on the JWT, and none of
 * them share a users collection.
 */
export interface IUsageMeter extends Document {
  subjectId: string;
  meter: MeterKey;
  /** `ALL` for cumulative meters, `YYYY-MM` for monthly ones. */
  period: string;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

const UsageMeterSchema = new Schema<IUsageMeter>(
  {
    subjectId: { type: String, required: true, lowercase: true, trim: true },
    meter: { type: String, required: true },
    period: { type: String, required: true, default: 'ALL' },
    count: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

UsageMeterSchema.index({ subjectId: 1, meter: 1, period: 1 }, { unique: true });

/**
 * Registered through `models` first: several services import this module into
 * the same mongoose singleton during tests, and a second `model()` call with
 * the same name throws `OverwriteModelError`.
 */
export const UsageMeter: Model<IUsageMeter> =
  (models.UsageMeter as Model<IUsageMeter>) || model<IUsageMeter>('UsageMeter', UsageMeterSchema);

/** The period bucket a meter counts into right now. Monthly meters roll over at 00:00 UTC on the 1st. */
export function currentPeriod(meter: MeterKey, now: Date = new Date()): string {
  const period: MeterPeriod = meterPeriod(meter);
  if (period === 'ALL') return 'ALL';
  return now.toISOString().slice(0, 7); // YYYY-MM
}
