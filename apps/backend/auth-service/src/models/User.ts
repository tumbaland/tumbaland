import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  firstName?: string;
  lastName?: string;
  signupMethod: string; // e.g. google
  roles: string[];
  isApproved: boolean; // automatic approval for new users
  lastLoginAt?: Date;
  tokenVersion: number; // for token invalidation
  /**
   * When the owner asked for the account to be removed, if they have.
   *
   * A request, not the removal. Nothing is deleted or disabled when this is
   * set: the account signs in and works exactly as before, and an administrator
   * removes the data by hand later. That is deliberate — an automatic cascade
   * across five services with photos in object storage is the kind of thing
   * that half-succeeds quietly, and a person who mis-clicked has no way back
   * from it.
   *
   * Absence means no request. Cleared rather than set to false when the owner
   * changes their mind, so the field also carries when they asked.
   */
  deletionRequestedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    signupMethod: { type: String, required: true },
    roles: { type: [String], default: [] },
    isApproved: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    tokenVersion: { type: Number, default: 1 },
    deletionRequestedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

/**
 * The administrator's queue: `db.users.find({ deletionRequestedAt: { $ne: null } })`.
 *
 * Sparse, because the field is null on almost every document and an index over
 * a column of nulls is a full copy of the collection for no benefit.
 */
UserSchema.index({ deletionRequestedAt: 1 }, { sparse: true });

export const User = model<IUser>('User', UserSchema);
