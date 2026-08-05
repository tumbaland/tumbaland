import mongoose, { Schema, Document } from 'mongoose';

// Interface for ActivityType document
export interface IActivityType extends Document {
  id: string;
  name: string; // Display name 
  slug: string; // URL-friendly identifier
  description?: string; // Optional description
  color?: string; // Optional color for UI (hex code)
  icon?: string; // Optional icon identifier
  valueType: 'string' | 'boolean' | 'number'; // How the description value is captured
  hasLocation: boolean; // Whether entries of this type can carry a place (orthogonal to valueType)
  isActive: boolean; // Whether this type is active/available
  sortOrder: number; // For ordering in UI
  createdAt: Date;
  updatedAt: Date;
  userId: string; // User who created this type (for personal types)
  groupId?: string; // Optional group association (for group-specific types)
}

// Interface for ActivityType model with static methods
export interface IActivityTypeModel extends mongoose.Model<IActivityType> {
}

// ActivityType schema
const ActivityTypeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
      validate: {
        validator: function(v: string) {
          return /^[a-z0-9-]+$/.test(v);
        },
        message: 'Slug can only contain lowercase letters, numbers, and hyphens'
      }
    },
    description: {
      type: String,
      maxlength: 200
    },
    color: {
      type: String,
      validate: {
        validator: function(v: string) {
          return /^#[0-9A-F]{6}$/i.test(v);
        },
        message: 'Color must be a valid hex code (e.g., #FF5733)'
      }
    },
    icon: {
      type: String,
      maxlength: 50
    },
    valueType: {
      type: String,
      enum: ['string', 'boolean', 'number'],
      default: 'string'
    },
    hasLocation: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
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
    collection: 'activity_types'
  }
);

// Indexes for better query performance
ActivityTypeSchema.index({ slug: 1 });
ActivityTypeSchema.index({ userId: 1, groupId: 1 });
ActivityTypeSchema.index({ isActive: 1, sortOrder: 1 });

// A slug only has to be unique within its own scope — one user's "movies" must
// not stop anyone else creating theirs. Group types are unique per group, and
// personal types per user; the partial filters keep the two apart so a personal
// type never collides with a group's.
//
// The personal filter is `{ groupId: null }` rather than `{ $exists: false }`:
// Mongo rejects `$exists: false` in a partial index ("Expression not supported
// in partial index: $not"), while null-equality matches both an explicit null
// and a missing field — which is exactly the set the service treats as personal.
ActivityTypeSchema.index(
  { groupId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { groupId: { $type: 'string' } } }
);
ActivityTypeSchema.index(
  { userId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { groupId: null } }
);

// Pre-save middleware to generate slug from name if not provided
ActivityTypeSchema.pre('save', function(this: IActivityType) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
});


export const ActivityType = mongoose.model<IActivityType, IActivityTypeModel>('ActivityType', ActivityTypeSchema);