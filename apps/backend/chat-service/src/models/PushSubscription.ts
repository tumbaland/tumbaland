import { Schema, model, Document } from 'mongoose';

/**
 * One browser's Web Push endpoint.
 *
 * Keyed on `endpoint`, which is what the push service hands the browser and
 * what uniquely identifies a device-plus-browser. A person has as many rows as
 * they have installed copies: a phone, a tablet, a laptop.
 *
 * `failureCount` exists because endpoints die silently. A phone that is reset
 * leaves a row that will never deliver again, and without pruning those
 * accumulate until every send is mostly 410s.
 */
export interface IPushSubscription extends Document {
  /** `User._id`. A device belongs to an account, not to an address. */
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  platform?: string;
  lastSeenAt: Date;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId: { type: String, required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true }
    },
    userAgent: { type: String, default: '' },
    platform: { type: String, default: '' },
    lastSeenAt: { type: Date, default: Date.now },
    failureCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const PushSubscription = model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);
