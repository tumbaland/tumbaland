import mongoose, { Document, Schema } from 'mongoose';
import type { ApiKeyScope } from './types';

/**
 * One API key. Lives in backend-core rather than auth-service because both
 * halves need it: auth-service issues and revokes keys, and every other service
 * verifies them on the way in. All services share one database, so the model is
 * shared rather than the lookup going over HTTP on every request.
 */
export interface IApiKey extends Document {
  userId: string;
  /**
   * The owner's identity as it stood when the key was issued.
   *
   * Snapshotted so verifying a key stays a single indexed read. Every
   * authenticated request would otherwise need a second query into the users
   * collection to fill in a `UserPayload`, to serve fields almost no handler
   * reads. The cost is that a later rename shows the old name on requests made
   * with this key, which is a fair price and easy to reason about.
   */
  userEmail: string;
  userName: string;
  /** what the user called it — "Claude Code", "home assistant" */
  name: string;
  /** the public half of the token; unique, and what a presented key is looked up by */
  keyId: string;
  /** SHA-256 of the secret half — what verification actually compares against */
  hash: string;
  /** the whole token, encrypted, so the owner can read it back later */
  sealedCiphertext: string;
  sealedIv: string;
  sealedTag: string;
  scopes: ApiKeyScope[];
  /** the tenant this key acts in; null means the user's own non-group data */
  groupId: string | null;
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  /** reveals are counted and timestamped — reading back a key is worth an audit trail */
  revealCount: number;
  lastRevealedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    userId: { type: String, required: true, index: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true, default: '' },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    keyId: { type: String, required: true, unique: true, index: true },
    hash: { type: String, required: true },
    sealedCiphertext: { type: String, required: true },
    sealedIv: { type: String, required: true },
    sealedTag: { type: String, required: true },
    scopes: { type: [String], default: [] },
    // Explicitly nullable rather than optional: "personal scope" is a decision the
    // creator made, and it must not be indistinguishable from a field nobody set.
    groupId: { type: String, default: null },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    revealCount: { type: Number, default: 0 },
    lastRevealedAt: { type: Date }
  },
  { timestamps: true, collection: 'api_keys' }
);

// Every listing is one user's keys, newest first.
ApiKeySchema.index({ userId: 1, createdAt: -1 });

export const ApiKey = mongoose.models.ApiKey
  ? (mongoose.models.ApiKey as mongoose.Model<IApiKey>)
  : mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
