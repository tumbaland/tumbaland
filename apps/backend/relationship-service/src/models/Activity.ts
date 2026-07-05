import mongoose, { Schema, Document } from 'mongoose';

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
  createdAt: Date;
  updatedAt: Date;
  userId: string; // User ID who created the activity
  groupId?: string; // Optional group association
}

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

// Indexes for better query performance
ActivitySchema.index({ typeId: 1, date: -1 });
ActivitySchema.index({ date: -1 });
ActivitySchema.index({ createdAt: -1 });

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);
