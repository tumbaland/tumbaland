import mongoose, { Schema, Document } from 'mongoose';

export interface ITrackedTicker extends Document {
  ticker: string;
  displayName: string;
  description?: string;
  /**
   * The currency this instrument is quoted in, so its prices can be converted
   * to the base currency before being summed with anything else. Filled
   * automatically from SYMBOL_SEARCH when the ticker is picked from search;
   * left unset for tickers added before this field existed, which are treated
   * as already being in the base currency rather than guessed at.
   */
  currency?: string;
  dateAdded: Date;
  isActive: boolean;
  userId: string; // User ID who created the ticker
  groupId?: string; // Optional group association
}

const TrackedTickerSchema: Schema = new Schema({
  ticker: { type: String, required: true },
  displayName: { type: String, required: true },
  description: { type: String },
  currency: { type: String, uppercase: true, trim: true },
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

// Same user (or group) cannot track the same ticker twice
TrackedTickerSchema.index({ ticker: 1, userId: 1, groupId: 1 }, { unique: true, sparse: true });

export default mongoose.model<ITrackedTicker>('TrackedTicker', TrackedTickerSchema);
