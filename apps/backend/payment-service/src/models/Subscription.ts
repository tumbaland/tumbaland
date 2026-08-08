import { Schema, model, Document, Types } from 'mongoose';

export interface ISubscription extends Document {
  userEmail: string;
  planCode: string; // denormalized for quick filter
  plan: Types.ObjectId;
  // `canceling` = cancellation requested, Stripe will not renew, but the period the user
  // already paid for is still running. Entitlement resolution treats it as entitled;
  // the customer.subscription.deleted webhook flips it to `canceled` when the period ends.
  status: 'active' | 'past_due' | 'canceled' | 'canceling' | 'incomplete';
  renewsAt?: Date; // next renewal
  cancelAt?: Date;
  canceledAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  latestInvoiceId?: string;
  /**
   * A subscription granted by an admin rather than bought — staff, friends,
   * support gestures. Stripe knows nothing about it, so nothing here ever
   * invoices; entitlements resolve exactly as they do for a paying customer.
   *
   * Flagged rather than inferred from a missing `stripeSubscriptionId`, because
   * a genuine subscription is briefly in that state too (`incomplete`, mid
   * checkout) — and because revenue reporting has to be able to exclude these.
   */
  isComp?: boolean;
  grantedBy?: string;
  grantReason?: string;
  /** Optional end of a grant. Past this instant it stops granting anything. */
  expiresAt?: Date;
  createdAt: Date; updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  userEmail: { type: String, required: true, index: true, lowercase: true, trim: true },
  planCode: { type: String, required: true },
  plan: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  status: { type: String, enum: ['active','past_due','canceled','canceling','incomplete'], default: 'incomplete' },
  renewsAt: { type: Date },
  cancelAt: { type: Date },
  canceledAt: { type: Date },
  stripeCustomerId: { type: String },
  stripeSubscriptionId: { type: String },
  latestInvoiceId: { type: String },
  isComp: { type: Boolean, default: false },
  grantedBy: { type: String },
  grantReason: { type: String },
  expiresAt: { type: Date }
},{ timestamps: true });

SubscriptionSchema.index({ userEmail: 1, status: 1 });

export const Subscription = model<ISubscription>('Subscription', SubscriptionSchema);
