import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  signupMethod: string; // e.g. google
  roles: string[];
  isApproved: boolean; // manual authorization gate
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    signupMethod: { type: String, required: true },
    roles: { type: [String], default: [] },
    isApproved: { type: Boolean, default: false },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
