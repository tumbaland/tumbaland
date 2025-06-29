import mongoose, { Schema, Document } from 'mongoose';

export interface ITrackedTicker extends Document {
  ticker: string;
  displayName: string;
  description?: string;
  dateAdded: Date;
  isActive: boolean;
}

const TrackedTickerSchema: Schema = new Schema({
  ticker: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  description: { type: String },
  dateAdded: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

export default mongoose.model<ITrackedTicker>('TrackedTicker', TrackedTickerSchema);
