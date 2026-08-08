import { Schema, model, Document } from 'mongoose';
import { METER_KEYS, FEATURE_KEYS, MeterKey, FeatureKey } from '@tumbaland/backend-core';

/**
 * A per-user adjustment layered on top of whatever their plan grants.
 *
 * The tool for "give this friend 20 GB instead of 1" or "+10 GB for a month
 * while you migrate" — not for "this person pays nothing", which is a comp
 * subscription on the staff plan. Keeping the two separate matters: a comp
 * grant is a plan the user is *on*, and it shows in the UI as their plan; an
 * override is invisible bonus room on the plan they already have.
 *
 * Every field is optional and partial. Anything unset falls through to the plan.
 */
export interface IEntitlementOverride extends Document {
  userEmail: string;
  meters?: Partial<Record<MeterKey, number>>;
  features?: Partial<Record<FeatureKey, boolean>>;
  retentionDays?: number;
  /** Why this exists. Required — an unexplained override is one nobody dares remove. */
  reason: string;
  grantedBy: string;
  /**
   * When the adjustment lapses. A temporary bump nobody remembers to revoke
   * quietly becomes permanent, so the expiry is part of the record.
   */
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const meterFields = Object.fromEntries(METER_KEYS.map(key => [key, { type: Number, min: -1 }]));
const featureFields = Object.fromEntries(FEATURE_KEYS.map(key => [key, { type: Boolean }]));

const EntitlementOverrideSchema = new Schema<IEntitlementOverride>({
  userEmail: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
  meters: { type: new Schema(meterFields, { _id: false }), default: undefined },
  features: { type: new Schema(featureFields, { _id: false }), default: undefined },
  retentionDays: { type: Number, min: -1 },
  reason: { type: String, required: true },
  grantedBy: { type: String, required: true },
  expiresAt: { type: Date }
}, { timestamps: true });

export const EntitlementOverride = model<IEntitlementOverride>('EntitlementOverride', EntitlementOverrideSchema);
