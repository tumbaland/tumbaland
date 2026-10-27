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
   * The picture the person uploaded themselves, as its public URL (see
   * `Avatar`). Wins over `googlePicture` whenever it is set.
   */
  picture?: string | null;
  /**
   * The picture Google sent at the last sign-in. Kept apart from `picture` so
   * signing in again cannot overwrite an uploaded one, and so removing an
   * upload has something to fall back to.
   */
  googlePicture?: string | null;
  /**
   * The name Google sent at the last sign-in. Shown only while the person has
   * not set a first or last name of their own (see effectiveName).
   */
  googleName?: string | null;
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
  /**
   * When an administrator confirmed the request, which closes the account.
   *
   * Still not a deletion: the data is all where it was, and removing it stays a
   * manual job. What changes is the account itself. Confirming signs the person
   * out everywhere and cuts off their keys and connected apps, and sign-in is
   * refused from then on (see `signIn`), so a closed account cannot quietly
   * carry on being used while it waits for its data to be removed.
   *
   * The three states, in order: requested (`deletionRequestedAt`; works as
   * before, the owner can cancel), confirmed (this field; closed, data still
   * present) and removed (a later change; the document and its data are gone).
   * An administrator reopens a confirmed one by clearing this and the request.
   */
  deletionConfirmedAt?: Date | null;
  /** The administrator who confirmed it, as a user id. */
  deletionConfirmedBy?: string | null;
  /**
   * Whether "My money" is listed in this person's own menu. Off unless they
   * turn it on: a couple's app should not put someone's finances in the
   * navigation by default, and their partner has no use for an empty one.
   */
  showMoney: boolean;
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
    picture: { type: String, default: null },
    googlePicture: { type: String, default: null },
    googleName: { type: String, default: null },
    deletionRequestedAt: { type: Date, default: null },
    // No default, unlike the request above: a sparse index skips a missing field
    // but still indexes an explicit null, so leaving these unset is what keeps
    // the "closed accounts" index the size of the closed accounts.
    deletionConfirmedAt: { type: Date },
    deletionConfirmedBy: { type: String },
    showMoney: { type: Boolean, default: false }
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
UserSchema.index({ deletionConfirmedAt: 1 }, { sparse: true });

export const User = model<IUser>('User', UserSchema);
