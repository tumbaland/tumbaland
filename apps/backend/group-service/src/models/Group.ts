import { Schema, model, Document } from 'mongoose';

export type GroupRole = 'owner' | 'admin' | 'member';

export interface IGroupMember {
  email: string;
  role: GroupRole;
  joinedAt: Date;
}

export interface IGroupInvite {
  email: string;
  role: GroupRole;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface IGroup extends Document {
  name: string;
  createdBy: string; // email
  members: IGroupMember[];
  invites?: IGroupInvite[];
  createdAt: Date;
  updatedAt: Date;
}

const GroupSchema = new Schema<IGroup>({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  createdBy: { type: String, required: true, lowercase: true, index: true },
  members: [{
    email: { type: String, required: true, lowercase: true, index: true },
    role: { type: String, enum: ['owner','admin','member'], required: true },
    joinedAt: { type: Date, default: Date.now }
  }],
  invites: [{
    email: { type: String, required: true, lowercase: true },
    role: { type: String, enum: ['owner','admin','member'], default: 'member' },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
  }]
},{ timestamps: true });

GroupSchema.index({ 'members.email': 1 });

export const Group = model<IGroup>('Group', GroupSchema);
