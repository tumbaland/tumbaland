import mongoose, { Schema, Document } from 'mongoose';

/**
 * Which series a row belongs to. Daily and weekly closes live in one collection
 * but are never the same series: a weekly return annualized as if it were daily
 * overstates the figure roughly fivefold, so nothing may read them together by
 * accident. Every read filters on this, and the unique index carries it.
 *
 * Weekly exists because Alpha Vantage's free tier caps `TIME_SERIES_DAILY` at
 * the compact ~100 trading days (`outputsize=full` is a premium feature — the
 * API says so in as many words), while `TIME_SERIES_WEEKLY` returns the whole
 * series for free. A decade of weekly closes is a far better covariance
 * estimate than five months of daily ones.
 */
export type PriceInterval = 'daily' | 'weekly';

export interface ITickerPriceHistory extends Document {
  date: Date;
  ticker: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  interval: PriceInterval;
}

const TickerPriceHistorySchema: Schema = new Schema({
  date: { type: Date, required: true },
  ticker: { type: String, required: true },
  price: { type: Number, required: true },
  open: { type: Number },
  high: { type: Number },
  low: { type: Number },
  volume: { type: Number },
  // Defaulted rather than required: every row written before weekly existed is
  // a daily close, and a default keeps them valid without a data migration.
  interval: { type: String, enum: ['daily', 'weekly'], default: 'daily', required: true }
});

// Enforces one record per ticker per interval per day at the schema level, so a
// caller that gets the date normalization wrong gets a duplicate-key error
// instead of a silent duplicate row.
//
// `interval` had to join this index: weekly closes land on dates the daily
// series already holds, and the old `{ ticker, date }` constraint would have
// rejected them as duplicates of a different series. Mongoose adds the indexes
// a schema declares but never removes ones it has stopped declaring, so the old
// index is retired by scripts/migration/drop-stale-indexes.js.
TickerPriceHistorySchema.index({ ticker: 1, interval: 1, date: 1 }, { unique: true });

export default mongoose.model<ITickerPriceHistory>('TickerPriceHistory', TickerPriceHistorySchema);
