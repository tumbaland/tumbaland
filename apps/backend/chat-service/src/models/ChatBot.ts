import { Schema, model, Document, Types } from 'mongoose';
import { MODEL_IDS, type ModelId } from '../services/assistantModels';

/**
 * Bot colours, as hex. A palette rather than a free choice so every one can be
 * read on the thread's background; chat-front tints from it.
 */
export const BOT_COLORS = [
  '#7c3aed',
  '#0369a1',
  '#15803d',
  '#be123c',
  '#b45309',
  '#be185d',
  '#0f766e',
  '#4338ca'
] as const;

/**
 * An assistant someone added to a conversation: a name, a personality and a
 * model. It answers when a person mentions it, and acts as *that person*, not
 * as whoever made it: the personality is the owner's, the permissions are the
 * mentioner's. See assistantReplyService.
 *
 * Deleted for real rather than flagged. The messages it wrote keep its name and
 * its id, which is all a thread needs to keep reading correctly.
 */
export interface IChatBot extends Document {
  _id: Types.ObjectId;
  conversationId: string;
  /** `User._id` of whoever made it. Never changes: an admin editing a bot does not take it over. */
  ownerId: string;
  ownerName: string;
  /** What people type after the @. Unique in the conversation, case-insensitively. */
  name: string;
  /** How it talks. Readable by everyone in the conversation. */
  personality: string;
  /** What it should know about its owner. */
  aboutOwner: string;
  color: string;
  modelId: ModelId;
  /** Stays set up but does not answer. */
  paused: boolean;
  /** Now and then speaks up without being asked: see `maybeJoinIn` in assistantReplyService. */
  joinsIn: boolean;
  /** When it last did, for the gap it keeps between two. */
  lastJoinedAt: Date | null;
  /** Who last changed it: its owner, or an admin of the group. */
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChatBotSchema = new Schema<IChatBot>(
  {
    conversationId: { type: String, required: true },
    ownerId: { type: String, required: true },
    ownerName: { type: String, default: '' },
    name: { type: String, required: true, trim: true, maxlength: 24 },
    personality: { type: String, default: '', maxlength: 1500 },
    aboutOwner: { type: String, default: '', maxlength: 1500 },
    color: { type: String, enum: BOT_COLORS, default: BOT_COLORS[0] },
    modelId: { type: String, enum: MODEL_IDS, required: true },
    paused: { type: Boolean, default: false },
    joinsIn: { type: Boolean, default: false },
    lastJoinedAt: { type: Date, default: null },
    updatedById: { type: String, default: null }
  },
  { timestamps: true }
);

// One bot per person per conversation, to start.
ChatBotSchema.index({ conversationId: 1, ownerId: 1 }, { unique: true });

export const ChatBot = model<IChatBot>('ChatBot', ChatBotSchema);
