import { Schema, model, Document } from 'mongoose';

export interface IPayment extends Document {
  userEmail: string;
  amountCents: number;
  currency: string;
  type: 'subscription' | 'one_time';
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date; updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>({
  userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
  amountCents: { type: Number, required: true },
  currency: { type: String, default: 'eur' },
  type: { type: String, enum: ['subscription','one_time'], required: true },
  status: { type: String, enum: ['succeeded','pending','failed','refunded'], default: 'pending' },
  stripePaymentIntentId: { type: String },
  stripeChargeId: { type: String },
  metadata: { type: Object }
},{ timestamps: true });

PaymentSchema.index({ userEmail: 1, createdAt: -1 });

export const Payment = model<IPayment>('Payment', PaymentSchema);
