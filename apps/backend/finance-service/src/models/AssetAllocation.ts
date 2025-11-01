import mongoose, { Schema, Document } from 'mongoose';

export interface IAssetAllocation extends Document {
  _id: string;
  assetClassId: string; // Reference to AssetClass
  totalValue: number;
  gain: number;
  date: Date;
  userId: string; // User ID who created the allocation
  groupId?: string; // Optional group association
  createdAt: Date;
  updatedAt: Date;
}

const AssetAllocationSchema: Schema = new Schema({
  assetClassId: {
    type: String,
    required: true,
    index: true
  },
  totalValue: {
    type: Number,
    required: true,
    min: 0
  },
  gain: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
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
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Compound index for efficient queries by user/group and date
AssetAllocationSchema.index({ userId: 1, groupId: 1, date: -1 });

export default mongoose.model<IAssetAllocation>('AssetAllocation', AssetAllocationSchema);