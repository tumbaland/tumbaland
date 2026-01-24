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

export default mongoose.model<ITickerPriceHistory>('TickerPriceHistory', TickerPriceHistorySchema);
