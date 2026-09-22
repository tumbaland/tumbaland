import { Schema, model, Document } from 'mongoose';

/**
 * When each person was last active.
 *
 * Whether someone is online *right now* is held in memory by presenceService;
 * this is what survives a restart, so "Active 2 hours ago" still has an answer
 * after a deploy.
 */
export interface IPresence extends Document {
  /** `User._id`. */
  userId: string;
  lastActiveAt: Date | null;
}

const PresenceSchema = new Schema<IPresence>(
  {
    userId: { type: String, required: true },
    lastActiveAt: { type: Date, default: null }
  },
  { timestamps: true }
);

PresenceSchema.index({ userId: 1 }, { unique: true });

export const Presence = model<IPresence>('Presence', PresenceSchema);
