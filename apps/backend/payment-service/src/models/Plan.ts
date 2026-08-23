import { Schema, model, Document } from 'mongoose';
import { METER_KEYS, FEATURE_KEYS, PartialPlanLimits } from '@tumbaland/backend-core';

export interface IPlan extends Document {
  name: string;
  code: string; // unique key: free, support (+ hidden staff)
  description?: string;
  priceMonthlyCents: number; // 0 for free (base interval for now)
  priceYearlyCents?: number; // optional discounted billing amount (informational unless you add a yearly Stripe price later)
  features: string[]; // marketing bullets rendered on the pricing page
  /**
   * What the plan actually grants, enforced by the entitlement middleware in
   * `@tumbaland/backend-core`. Editable at runtime by an admin — moving a
   * ceiling must not require a deploy, and hardcoding it in the services would
   * guarantee drift between what is charged for and what is enforced.
   *
   * Any subset may be stored: `normalizeLimits` fills the gaps from the code
   * defaults for this plan code, so a new meter works everywhere the moment it
   * is added, without first backfilling every Plan document.
   */
  limits?: PartialPlanLimits;
  isActive: boolean;
  /**
   * Whether the plan appears in the public catalog and can be bought.
   *
   * Distinct from `isActive`, which means "not retired". The staff plan is
   * active — people are on it and it grants real entitlements — but must never
   * show on the pricing page or be offered as an upgrade target. Members of a
   * non-public plan still see their own plan on the pricing page; that is
   * handled in `listPlans`, not here.
   */
  isPublic: boolean;
  stripePriceId?: string; // single Stripe recurring price id (mode: subscription)
  createdAt: Date; updatedAt: Date;
}

// Built from the shared key registry rather than spelled out, so adding a
// meter is a one-line edit in backend-core and not a schema migration here.
const meterFields = Object.fromEntries(METER_KEYS.map(key => [key, { type: Number, min: -1 }]));
const featureFields = Object.fromEntries(FEATURE_KEYS.map(key => [key, { type: Boolean }]));

const PlanLimitsSchema = new Schema({
  meters: { type: new Schema(meterFields, { _id: false }), default: undefined },
  features: { type: new Schema(featureFields, { _id: false }), default: undefined },
  retentionDays: { type: Number, min: -1 }
}, { _id: false });

const PlanSchema = new Schema<IPlan>({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, index: true },
  description: { type: String },
  priceMonthlyCents: { type: Number, required: true, min: 0 },
  priceYearlyCents: { type: Number },
  features: { type: [String], default: [] },
  limits: { type: PlanLimitsSchema, default: undefined },
  isActive: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true },
  stripePriceId: { type: String }
},{ timestamps: true });

export const Plan = model<IPlan>('Plan', PlanSchema);
