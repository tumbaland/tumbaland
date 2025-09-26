import mongoose, { Schema, Document } from 'mongoose';

// Interface for Activity document
export interface IActivity extends Document {
  id: string;
  date: Date;
  hours: number; // integer
  activity: {
    typeId: mongoose.Types.ObjectId; // Reference to ActivityType
    description: string;
  };
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
    hours: {
      type: Number,
      required: false,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Hours must be an integer'
      }
    },
    activity: {
      typeId: {
        type: Schema.Types.ObjectId,
        ref: 'ActivityType',
        required: true
      },
      description: {
        type: String,
        required: false,
        maxlength: 500
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
ActivitySchema.index({ 'activity.typeId': 1, date: -1 });
ActivitySchema.index({ date: -1 });
ActivitySchema.index({ createdAt: -1 });

// Static methods
ActivitySchema.statics.getActivityTypes = async function (userId?: string, groupId?: string) {
  const ActivityType = mongoose.model('ActivityType');
  const query: any = { isActive: true };

  if (groupId) {
    query.$or = [
      { groupId },
      { userId, groupId: { $exists: false } }
    ];
  } else if (userId) {
    query.userId = userId;
    query.$or = [
      { groupId: { $exists: false } },
      { groupId: null }
    ];
  }

  return await ActivityType.find(query).sort({ sortOrder: 1 });
};

ActivitySchema.statics.getActivitiesByDateRange = function (startDate: Date, endDate: Date) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

ActivitySchema.statics.getActivityStats = function () {
  return this.aggregate([
    {
      $lookup: {
        from: 'activity_types',
        localField: 'activity.typeId',
        foreignField: '_id',
        as: 'activityType'
      }
    },
    {
      $unwind: '$activityType'
    },
    {
      $group: {
        _id: '$activityType.slug',
        name: { $first: '$activityType.name' },
        count: { $sum: 1 },
        totalHours: { $sum: '$hours' },
        avgHours: { $avg: '$hours' }
      }
    },
    {
      $sort: { totalHours: -1 }
    }
  ]);
};

export const Activity = mongoose.model<IActivity>('Activity', ActivitySchema);
