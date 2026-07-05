import mongoose, { Schema, Document } from 'mongoose';

/**
 * A position in a tradeable instrument (ETF, stock). Replaces the old
 * UserPortfolio model; the instrument field is named `ticker` to match
 * TrackedTicker and TickerPriceHistory (was `symbol`).
 */
export interface IHolding extends Document {
  ticker: string;
  quantity: number;
  avgBuyPrice: number;
  buyDate?: Date;
  notes?: string;
  userId: string;
  groupId?: string;
}

const HoldingSchema: Schema = new Schema({
  ticker: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true },
  avgBuyPrice: { type: Number, required: true },
  buyDate: { type: Date },
  notes: { type: String },
  userId: { type: String, required: true, index: true },
  groupId: { type: String, index: true }
});

export default mongoose.model<IHolding>('Holding', HoldingSchema);
