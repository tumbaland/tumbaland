import mongoose, { Schema, Document } from 'mongoose';

export interface ITrackedTicker extends Document {
  _id: string;
  ticker: string;
  displayName: string;
  description?: string;
  dateAdded: Date;
  isActive: boolean;
  userId: string; // User ID who created the ticker
  groupId?: string; // Optional group association
}

const TrackedTickerSchema: Schema = new Schema({
  ticker: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  description: { type: String },
  dateAdded: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  groupId: { 
    type: String, 
    index: true 
  }
});

export default mongoose.model<ITrackedTicker>('TrackedTicker', TrackedTickerSchema);
