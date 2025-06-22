import mongoose, { Schema, Document } from 'mongoose';

// Interface for Activity document
export interface IActivity extends Document {
  id: string;
  date: Date;
  hours: number; // integer
  activity: {
    type: string;
    description: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Activity schema
const ActivitySchema: Schema = new Schema({
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
    type: {
      type: String,
      required: true,
      enum: ['movies', 'cooking', 'dining', 'lunch', 'gaming', 'other', 'sex', 'together']
    },
    description: {
      type: String,
      required: false,
      maxlength: 500
    }
  }
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt
  collection: 'activities'
});

// Indexes for better query performance
ActivitySchema.index({ 'activity.type': 1, date: -1 });
ActivitySchema.index({ date: -1 });
ActivitySchema.index({ 'createdAt': -1 });

// Static methods
ActivitySchema.statics.getActivityTypes = function() {
  return ['movies', 'cooking', 'dining', 'lunch', 'gaming', 'other', 'sex', 'together'];
};

ActivitySchema.statics.getActivitiesByDateRange = function(startDate: Date, endDate: Date) {
  return this.find({
    date: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ date: -1 });
};

ActivitySchema.statics.getActivityStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$activity.type',
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
