import mongoose, { Schema, Document } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

// Where an entry happened. Present only on entries whose type opts in via
// ActivityType.hasLocation; orthogonal to valueType, so a 'string' type can
// carry both a description ("tasting menu") and a place ("Sushi House").
export interface IActivityLocation {
  label: string;
  lat: number;
  lng: number;
}

// One logged entry: something that happened on a date. What the entry carries
// depends on its type's valueType: 'string' types use description (e.g. which
// game, which restaurant), 'number' types use hours (e.g. hours together),
// 'boolean' types are presence markers (the entry existing means "yes").
export interface IActivity extends Document {
  id: string;
  date: Date;
  typeId: mongoose.Types.ObjectId; // Reference to ActivityType
  description?: string;
  hours?: number; // integer
  location?: IActivityLocation;
  createdAt: Date;
  updatedAt: Date;
  userId: string; // User ID who created the activity
  groupId?: string; // Optional group association
  /**
   * Who actually made the entry, and who last touched it.
   *
   * Distinct from `userId`, which is the account: in a shared journal that is
   * whichever member logged it, and it says nothing about whether they typed it
   * or an assistant did. Written by the audit plugin.
   */
  createdBy?: string;
  updatedBy?: string;
}

// Subdocument, not GeoJSON: the map renders every pin client-side and never
// runs a proximity query, so plain lat/lng avoids a 2dsphere index we'd never use.
const ActivityLocationSchema = new Schema<IActivityLocation>(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  },
  { _id: false }
);

// Activity schema
const ActivitySchema: Schema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true
    },
    typeId: {
      type: Schema.Types.ObjectId,
      ref: 'ActivityType',
      required: true
    },
    description: {
      type: String,
      required: false,
      maxlength: 500
    },
    hours: {
      type: Number,
      required: false,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Hours must be an integer'
      }
    },
    location: {
      type: ActivityLocationSchema,
      required: false
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    groupId: {
      type: String,
      index: true
    }
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    collection: 'activities'
  }
);

// Indexes for better query performance.
//
// Every scoped read filters on userId or groupId and then sorts on date, so the
// tenancy field has to lead: an index starting at `typeId` or `date` can serve
// neither branch of the `{ $or: [{ userId }, { groupId }] }` access query, and
// the sort spills to an in-memory sort.
ActivitySchema.index({ userId: 1, date: -1 });
ActivitySchema.index({ groupId: 1, date: -1 });
ActivitySchema.index({ userId: 1, createdAt: -1 });
ActivitySchema.index({ groupId: 1, createdAt: -1 });
ActivitySchema.index({ typeId: 1, date: -1 });
ActivitySchema.index({ date: -1 });
// The map page scans a whole scope for located entries; sparse so the index
// only holds the minority of entries that actually carry a place.
ActivitySchema.index({ userId: 1, 'location.label': 1 }, { sparse: true });
ActivitySchema.index({ groupId: 1, 'location.label': 1 }, { sparse: true });

// Attribution and a change trail, added at the model so no write path can
// forget it — including ones written after this line.
ActivitySchema.plugin(auditPlugin, { resource: 'activity' });

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);
