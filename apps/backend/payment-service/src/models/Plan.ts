import { Schema, model, Document } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  code: string; // unique key: free, pro, premium
  description?: string;
  priceMonthlyCents: number; // 0 for free (base interval for now)
  priceYearlyCents?: number; // optional discounted billing amount (informational unless you add a yearly Stripe price later)
  features: string[];
  isActive: boolean;
  stripePriceId?: string; // single Stripe recurring price id (mode: subscription)
  createdAt: Date; updatedAt: Date;
}

const PlanSchema = new Schema<IPlan>({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true, index: true },
  description: { type: String },
  priceMonthlyCents: { type: Number, required: true, min: 0 },
  priceYearlyCents: { type: Number },
  features: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  stripePriceId: { type: String }
},{ timestamps: true });

export const Plan = model<IPlan>('Plan', PlanSchema);
