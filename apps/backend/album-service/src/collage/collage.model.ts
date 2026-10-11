import mongoose, { Document, Schema } from 'mongoose';

export interface CollageConfig {
  version: string;
  date: string;
  viewport: {
    width: number;
    height: number;
  };
  theme: string;
  photos: Array<{
    photoId: string; // Reference to photo database ID
    filename: string;
    caption: string;
    position: {
      left: number;
      top: number;
    };
    width: number;
    height: number;
    rotation: number;
    frameVisible: boolean;
    scaleX: string;
    scaleY: string;
  }>;
  textSections: Array<Record<string, unknown>>;
  title: {
    text: string;
    subtitle: string;
  };
  albumIds: string[]; // Updated: albumIds array to support multiple albums
}

export interface CollageMaker {
  kind: 'assistant';
  /** "Claude", or whatever the connection is called in account settings */
  label: string;
}

export interface ICollage extends Document {
  title: string;
  config: CollageConfig;
  albumIds: string[]; // Updated: albumIds array for multiple albums
  userId?: string; // User ID who created the collage
  groupId?: string; // Optional group association
  /**
   * Bumped on every write. A batch of changes is applied to the config it was
   * read with and stored only if nothing else wrote in between, so two
   * people editing at once cannot overwrite each other.
   */
  revision: number;
  /** The chat it was made from with "Make a collage together", if any. */
  conversationId?: string;
  /** Durable idempotency key for requests from chat-service. */
  chatRequestKey?: string;
  /**
   * Set when a connected assistant made the collage, from the name its owner
   * gave the connection. An assistant may change only collages carrying this;
   * the ones people made are theirs. Absent on everything a person made.
   */
  madeBy?: CollageMaker;
  createdAt: Date;
  updatedAt: Date;
}

const CollageSchema = new Schema<ICollage>(
  {
    title: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true, default: () => ({ photos: [] }) },
    albumIds: { type: [String], required: true }, // Updated: albumIds as array
    userId: { type: String, index: true },
    groupId: { type: String, index: true },
    revision: { type: Number, default: 0 },
    conversationId: { type: String },
    chatRequestKey: { type: String, unique: true, sparse: true },
    madeBy: {
      type: new Schema<CollageMaker>({ kind: { type: String, enum: ['assistant'] }, label: String }, { _id: false }),
      required: false
    }
  },
  { timestamps: true }
);

// Add indexes for performance
CollageSchema.index({ albumIds: 1 }); // Index for filtering by album
CollageSchema.index({ createdAt: -1 }); // Index for sorting by creation date

export const CollageModel = mongoose.model<ICollage>('Collage', CollageSchema);
