import mongoose, { Schema, Document } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

export type TradeType = 'buy' | 'sell' | 'dividend' | 'fee';

/**
 * One event in a position's history. A `Holding` is the running total of these;
 * recording them individually is what makes realized P/L, dividend income and
 * cost-basis tracking possible at all — a single {quantity, avgBuyPrice} pair
 * cannot say what was sold, when, or for how much.
 *
 * `quantity`/`price` describe share-level events (buy, sell); `amount` carries
 * the cash total for events that have no share count (dividend, fee).
 */
export interface ITrade extends Document {
  ticker: string;
  type: TradeType;
  date: Date;
  quantity: number; // shares, buy/sell only
  price: number; // per share, buy/sell only
  amount: number; // cash total, dividend/fee only
  fees: number; // transaction costs on a buy/sell
  notes?: string;
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TradeSchema: Schema = new Schema(
  {
    ticker: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, enum: ['buy', 'sell', 'dividend', 'fee'] },
    date: { type: Date, required: true },
    quantity: { type: Number, default: 0, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    amount: { type: Number, default: 0, min: 0 },
    fees: { type: Number, default: 0, min: 0 },
    notes: { type: String },
    userId: { type: String, required: true },
    groupId: { type: String }
  },
  { timestamps: true }
);

// Reads are always "this owner's trades for this ticker, oldest first" — the
// order the position replay needs — so the index leads with tenancy.
TradeSchema.index({ userId: 1, ticker: 1, date: 1 });
TradeSchema.index({ groupId: 1, ticker: 1, date: 1 });

// Attribution and a change trail; see auditPlugin.
TradeSchema.plugin(auditPlugin, { resource: 'trade' });

export default mongoose.model<ITrade>('Trade', TradeSchema);
