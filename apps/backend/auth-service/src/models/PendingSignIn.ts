import { Schema, model, models, Model, Document } from 'mongoose';

/**
 * A Google sign-in that finished somewhere the app cannot see.
 *
 * On an iPhone home-screen app, Google's page opens in a Safari sheet with its
 * own cookies, so the callback can neither read the login page's cookie nor set
 * one the app will get. The callback stores the result here instead, under a
 * hash of the nonce the login page gave Google, and the login page collects it.
 *
 * Collecting needs the nonce (which only the page that started the sign-in
 * has) and the code shown after Google (which only the person who signed in
 * sees). Either alone is not enough: with only the nonce, someone could start a
 * sign-in, get another person to finish it, and collect their session.
 */
export interface IPendingSignIn extends Document {
  nonceHash: string;
  codeHash: string;
  email: string;
  name?: string;
  picture?: string;
  failedAttempts: number;
  expiresAt: Date;
}

const PendingSignInSchema = new Schema<IPendingSignIn>(
  {
    nonceHash: { type: String, required: true, unique: true },
    codeHash: { type: String, required: true },
    email: { type: String, required: true },
    name: { type: String },
    picture: { type: String },
    failedAttempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'pending_google_signins' }
);

PendingSignInSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingSignIn: Model<IPendingSignIn> =
  (models.PendingSignIn as Model<IPendingSignIn>) || model<IPendingSignIn>('PendingSignIn', PendingSignInSchema);
