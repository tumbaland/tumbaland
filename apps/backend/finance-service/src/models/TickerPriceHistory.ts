import mongoose, { Schema, Document } from 'mongoose';

export interface ITickerPriceHistory extends Document {
  date: Date;
  ticker: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
}

const TickerPriceHistorySchema: Schema = new Schema({
  date: { type: Date, required: true },
  ticker: { type: String, required: true },
  price: { type: Number, required: true },
  open: { type: Number },
  high: { type: Number },
  low: { type: Number },
  volume: { type: Number }
});

// Enforces one record per ticker per day at the schema level, so a caller
// that gets the date normalization wrong gets a duplicate-key error instead
// of a silent duplicate row.
TickerPriceHistorySchema.index({ ticker: 1, date: 1 }, { unique: true });

export default mongoose.model<ITickerPriceHistory>('TickerPriceHistory', TickerPriceHistorySchema);
