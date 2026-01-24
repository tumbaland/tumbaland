import mongoose, { Schema, Document } from 'mongoose';

export interface IAssetClass extends Document {
  name: string;
  description?: string;
  color?: string; // Default color for charts
  userId: string; // User ID who created the asset class
  groupId?: string; // Optional group association
  createdAt: Date;
  updatedAt: Date;
}

const AssetClassSchema: Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  color: {
    type: String,
    trim: true,
    default: '#667eea' // Default color
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

export default mongoose.model<IAssetClass>('AssetClass', AssetClassSchema);