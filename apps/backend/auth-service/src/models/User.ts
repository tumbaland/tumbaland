import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  firstName?: string;
  lastName?: string;
  signupMethod: string; // e.g. google
  roles: string[];
  isApproved: boolean; // automatic approval for new users
  lastLoginAt?: Date;
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
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
