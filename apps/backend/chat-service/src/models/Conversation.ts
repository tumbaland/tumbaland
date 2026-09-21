import { Schema, model, Document, Types } from 'mongoose';

/**
 * Someone who has actually opened this conversation.
 *
 * Not the membership list: that is the group's, it lives in group-service, and
 * it is the only thing access is ever decided by. This is the roster of people
 * who have been seen here, recorded so offline push has somewhere to send to.
 * A group member who has never opened the app is absent, which costs nothing —
 * they have no push subscription either.
 */
export interface IConversationMember {
  /** `User._id`. The identity key: stable, and never reused. */
  userId: string;
  /** Carried for display and for the entitlement meters, which are email-keyed. */
  email: string;
  name: string;
  joinedAt: Date;
}

export interface IConversation extends Document {
  _id: Types.ObjectId;
  /**
   * The group whose members may read and post. Chat has no sharing model of
   * its own: a two-person chat is a group of two, and `canAccessResource`
   * answers the same question here as it does for an album.
   */
  groupId: string;
  /**
   * Empty for a group's default conversation. Not optional, because it is half
   * of the unique key below and an absent field and an empty string index
   * differently.
   */
  title: string;
  /** `User._id` of whoever created it. */
  createdById: string;
  createdBy: string;
  members: IConversationMember[];
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  lastMessageSender?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMemberSchema = new Schema<IConversationMember>(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    name: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    groupId: { type: String, required: true, index: true },
    title: { type: String, trim: true, maxlength: 120, default: '' },
    createdById: { type: String, required: true },
    createdBy: { type: String, required: true, lowercase: true },
    members: { type: [ConversationMemberSchema], default: [] },
    lastMessageAt: { type: Date, default: null },
    // Enough to draw the conversation list without loading a message.
    lastMessagePreview: { type: String, maxlength: 200, default: '' },
    lastMessageSender: { type: String, default: '' },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// The conversation list query: the caller's groups, newest activity first.
ConversationSchema.index({ groupId: 1, lastMessageAt: -1 });

/**
 * One conversation per group per title.
 *
 * The client calls "create" on first open rather than asking whether it needs
 * to, so two phones opening the app in the same second both find nothing and
 * both insert. A find-then-create in application code cannot close that
 * window; only the database can, which is what this index is for. The insert
 * goes through an upsert so the duplicate loses the race harmlessly instead of
 * erroring.
 */
ConversationSchema.index({ groupId: 1, title: 1 }, { unique: true });

export const Conversation = model<IConversation>('Conversation', ConversationSchema);
