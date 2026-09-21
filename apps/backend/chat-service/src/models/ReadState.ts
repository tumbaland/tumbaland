import { Schema, model, Document } from 'mongoose';

/**
 * How far each person has read in each conversation.
 *
 * One document per person per conversation, rather than a read flag on every
 * message. Opening a thread with 400 unread messages would otherwise write 400
 * documents, and the unread count would be a count query over the same.
 */
export interface IReadState extends Document {
  conversationId: string;
  /** `User._id`. Only someone who has signed in can have read anything. */
  userId: string;
  lastReadAt: Date;
  lastReadMessageId?: string;
}

const ReadStateSchema = new Schema<IReadState>(
  {
    conversationId: { type: String, required: true },
    userId: { type: String, required: true },
    lastReadAt: { type: Date, default: () => new Date(0) },
    lastReadMessageId: { type: String, default: null }
  },
  { timestamps: true }
);

ReadStateSchema.index({ conversationId: 1, userId: 1 }, { unique: true });

export const ReadState = model<IReadState>('ReadState', ReadStateSchema);
