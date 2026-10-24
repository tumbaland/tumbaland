import { Schema, model, Document } from 'mongoose';

/** A Stripe event this service has already applied. */
export interface IWebhookEvent extends Document {
  eventId: string;
  createdAt: Date;
}

/** Stripe stops retrying an event after about three days; a month leaves ample margin. */
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

const WebhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

WebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });

export const WebhookEvent = model<IWebhookEvent>('WebhookEvent', WebhookEventSchema);
