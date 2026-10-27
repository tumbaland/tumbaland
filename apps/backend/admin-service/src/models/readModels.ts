import { Schema, model, models, Model, Types } from 'mongoose';
import { USER_SESSIONS_COLLECTION } from '@tumbaland/backend-core';

/**
 * The collections other services own, as this one reads them.
 *
 * Each lists only the fields the admin screens use, so the shape of what leaves
 * this service is decided here and not by whatever the owner happens to store:
 * a field that is not in the schema is not selectable, and a person's password
 * hash, if one ever existed, could not be returned by forgetting a projection.
 *
 * Read only by convention and by use: nothing in this service calls `save`,
 * `create` or an update on any of them. They are deliberately not copies of the
 * owners' models, which carry hooks, validation and indexes that belong to the
 * owner; they are registered under their own names so the two never collide
 * when a test loads both.
 */

export interface AdminUserDoc {
  _id: Types.ObjectId;
  email: string;
  firstName?: string;
  lastName?: string;
  googleName?: string | null;
  roles: string[];
  createdAt: Date;
  lastLoginAt?: Date;
  deletionRequestedAt?: Date | null;
  deletionConfirmedAt?: Date | null;
  deletionConfirmedBy?: string | null;
}

const AdminUserSchema = new Schema<AdminUserDoc>(
  {
    email: String,
    firstName: String,
    lastName: String,
    googleName: String,
    roles: [String],
    createdAt: Date,
    lastLoginAt: Date,
    deletionRequestedAt: Date,
    deletionConfirmedAt: Date,
    deletionConfirmedBy: String
  },
  { collection: 'users', strict: true }
);

export const AdminUser: Model<AdminUserDoc> =
  (models.AdminUser as Model<AdminUserDoc>) || model<AdminUserDoc>('AdminUser', AdminUserSchema);

export interface AdminSessionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  userAgent?: string;
  country?: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

const AdminSessionSchema = new Schema<AdminSessionDoc>(
  {
    userId: Schema.Types.ObjectId,
    userAgent: String,
    country: String,
    createdAt: Date,
    lastSeenAt: Date,
    expiresAt: Date
  },
  { collection: USER_SESSIONS_COLLECTION, strict: true }
);

export const AdminSession: Model<AdminSessionDoc> =
  (models.AdminSession as Model<AdminSessionDoc>) ||
  model<AdminSessionDoc>('AdminSession', AdminSessionSchema);

export interface AdminGroupDoc {
  _id: Types.ObjectId;
  name: string;
  createdBy: string;
  members: Array<{ email: string; role: string }>;
  deletedAt?: Date | null;
}

const AdminGroupSchema = new Schema<AdminGroupDoc>(
  {
    name: String,
    createdBy: String,
    members: [{ _id: false, email: String, role: String }],
    deletedAt: Date
  },
  { collection: 'groups', strict: true }
);

export const AdminGroup: Model<AdminGroupDoc> =
  (models.AdminGroup as Model<AdminGroupDoc>) || model<AdminGroupDoc>('AdminGroup', AdminGroupSchema);

/** An album, only for how much of it a person owns: its name and photos are not selected anywhere. */
export interface AdminAlbumDoc {
  userId: string;
  photoCount: number;
  totalSize: number;
}

const AdminAlbumSchema = new Schema<AdminAlbumDoc>(
  { userId: String, photoCount: Number, totalSize: Number },
  { collection: 'albums', strict: true }
);

export const AdminAlbum: Model<AdminAlbumDoc> =
  (models.AdminAlbum as Model<AdminAlbumDoc>) || model<AdminAlbumDoc>('AdminAlbum', AdminAlbumSchema);

/** A journal entry, only to count them: its description and place are not selectable. */
export interface AdminActivityDoc {
  userId: string;
}

const AdminActivitySchema = new Schema<AdminActivityDoc>(
  { userId: String },
  { collection: 'activities', strict: true }
);

export const AdminActivity: Model<AdminActivityDoc> =
  (models.AdminActivity as Model<AdminActivityDoc>) ||
  model<AdminActivityDoc>('AdminActivity', AdminActivitySchema);

/** finance-service's per-provider daily call counter. */
export interface AdminApiUsageDoc {
  provider: string;
  date: string;
  count: number;
}

const AdminApiUsageSchema = new Schema<AdminApiUsageDoc>(
  { provider: String, date: String, count: Number },
  // finance-service's `ApiUsage`, under mongoose's default collection name for it.
  { collection: 'apiusages', strict: true }
);

export const AdminApiUsage: Model<AdminApiUsageDoc> =
  (models.AdminApiUsage as Model<AdminApiUsageDoc>) ||
  model<AdminApiUsageDoc>('AdminApiUsage', AdminApiUsageSchema);
