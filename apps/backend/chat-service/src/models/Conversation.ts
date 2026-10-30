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
  /** Profile picture URL, kept current like the name. Absent for someone without one. */
  picture?: string | null;
  joinedAt: Date;
}

/**
 * Where this conversation's photos and videos are saved in Album.
 *
 * One setting for the whole conversation, shared by everyone in it: when one
 * person switches it to "Rome" for a trip, the other's photos go there too.
 * `unset` until someone first chooses, which is when chat asks.
 */
export interface IPhotoAlbumSetting {
  mode: 'unset' | 'album' | 'off';
  albumId?: string | null;
  /** Kept for display, so the composer can say where photos go without asking Album. */
  albumName?: string | null;
  setById?: string | null;
  setAt?: Date | null;
}

/**
 * How the thread looks, for everyone in it: a preset theme (bubble colour and
 * background) and, optionally, one of the conversation's own photos behind it.
 */
export interface IAppearanceSetting {
  theme: string;
  /** A photo sent in this conversation. Cleared when that message is unsent. */
  backgroundFileId?: string | null;
}

/**
 * The conversation's assistants, as a whole: who has agreed to them, what they
 * all know, and what the group's admins have decided.
 *
 * Assistants are on only when every person in the conversation has agreed and
 * an admin has not locked them off. Each person's agreement is their own and
 * nobody can give it for them; an admin can only take assistants away.
 */
export interface IAssistantsSetting {
  /** `User._id` of everyone who has switched assistants on for themselves. */
  enabledBy: string[];
  /** Shared facts every assistant here should keep in mind: "we live in Tallinn". */
  aboutUs: string;
  /** An owner or admin of the group has turned assistants off for this conversation. */
  lockedOff: boolean;
  /** Who may add a bot: anyone in the conversation, or only the group's owner and admins. */
  whoCanAdd: 'everyone' | 'admins';
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
  photoAlbum?: IPhotoAlbumSetting;
  appearance?: IAppearanceSetting;
  assistants?: IAssistantsSetting;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationMemberSchema = new Schema<IConversationMember>(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    name: { type: String, default: '' },
    picture: { type: String, default: null },
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
    photoAlbum: {
      type: new Schema<IPhotoAlbumSetting>(
        {
          mode: { type: String, enum: ['unset', 'album', 'off'], default: 'unset' },
          albumId: { type: String, default: null },
          albumName: { type: String, default: null },
          setById: { type: String, default: null },
          setAt: { type: Date, default: null }
        },
        { _id: false }
      ),
      default: () => ({ mode: 'unset' })
    },
    appearance: {
      type: new Schema<IAppearanceSetting>(
        {
          theme: { type: String, default: 'classic' },
          backgroundFileId: { type: String, default: null }
        },
        { _id: false }
      ),
      default: () => ({ theme: 'classic' })
    },
    assistants: {
      type: new Schema<IAssistantsSetting>(
        {
          enabledBy: { type: [String], default: [] },
          aboutUs: { type: String, default: '', maxlength: 1500 },
          lockedOff: { type: Boolean, default: false },
          whoCanAdd: { type: String, enum: ['everyone', 'admins'], default: 'everyone' }
        },
        { _id: false }
      ),
      default: () => ({ enabledBy: [], aboutUs: '', lockedOff: false, whoCanAdd: 'everyone' })
    },
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
