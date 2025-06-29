import mongoose, { Schema, Document } from 'mongoose';

export interface ITickerPriceHistory extends Document {
  date: Date;
  ticker: string;
  price: number;
}

const TickerPriceHistorySchema: Schema = new Schema({
  date: { type: Date, required: true },
  ticker: { type: String, required: true },
  price: { type: Number, required: true }
});

export default mongoose.model<ITickerPriceHistory>('TickerPriceHistory', TickerPriceHistorySchema);
