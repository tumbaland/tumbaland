import { Schema, model, models, Model, Document, Types } from 'mongoose';
import { USER_SESSIONS_COLLECTION } from '@tumbaland/backend-core';

export const SIGN_IN_METHODS = ['google', 'unknown'] as const;
export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

/**
 * One signed-in device. The session token names it in its `sid` claim, and
 * every service's auth middleware requires it to exist and be unexpired, so
 * deleting a document is how a device is signed out. Nothing is kept once a
 * session ends: the TTL index removes expired ones and revocation deletes.
 */
export interface ISession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** How the person proved who they were; `unknown` for a pre-sessions token upgraded in place. */
  method: SignInMethod;
  /** The browser's User-Agent, truncated. Only ever shown back to its owner as a device label. */
  userAgent?: string;
  /** Country the device was last seen from (Cloudflare's CF-IPCountry), as an ISO code. */
  country?: string;
  createdAt: Date;
  /** Last renewal, to roughly the few minutes renewal is throttled to. */
  lastSeenAt: Date;
  /** Idle expiry: slides forward on renewal, never past `absoluteExpiresAt`. */
  expiresAt: Date;
  /** Hard cap from sign-in; however active the session, it ends here. */
  absoluteExpiresAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    method: { type: String, enum: SIGN_IN_METHODS, required: true },
    userAgent: { type: String, maxlength: 512 },
    country: { type: String, maxlength: 2 },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: USER_SESSIONS_COLLECTION }
);

// Expired sessions delete themselves. The middleware compares `expiresAt`
// itself as well, since the TTL monitor only runs about once a minute.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session: Model<ISession> =
  (models.Session as Model<ISession>) || model<ISession>('Session', SessionSchema);
