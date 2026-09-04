import mongoose, { Document, Schema } from 'mongoose';
import { PERSONAL_TENANT, type ApiKeyScope, type Tenant } from './types';

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
  /** every tenant this key may act in; see `Tenant` */
  tenants: Tenant[];
  /** the one it acts in when a request names none; always a member of `tenants` */
  defaultTenant: Tenant;
  /**
   * The single tenant this key was pinned to, before tenants were a set.
   *
   * Kept so keys issued under the old model keep working; `readTenants` falls
   * back to it. Nothing writes it any more.
   */
  groupId?: string | null;
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
    // Defaulted rather than optional: which data a key reaches is a decision the
    // creator made, and it must not be indistinguishable from a field nobody set.
    tenants: { type: [String], default: () => [PERSONAL_TENANT] },
    defaultTenant: { type: String, default: PERSONAL_TENANT },
    // Written by the single-tenant model this replaced; read-only now.
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
