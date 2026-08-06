import mongoose, { Schema, Document } from 'mongoose';

/**
 * One day's exchange rate for a currency pair: `rate` units of `quote` per one
 * unit of `base` (USD→EUR at 0.92 means one dollar buys 0.92 euro).
 *
 * Market data, not user data — the same pair is shared by everyone, so these
 * documents carry no tenancy fields.
 */
export interface IFxRate extends Document {
  base: string;
  quote: string;
  date: Date; // UTC midnight
  rate: number;
}

const FxRateSchema: Schema = new Schema({
  base: { type: String, required: true, uppercase: true, trim: true },
  quote: { type: String, required: true, uppercase: true, trim: true },
  date: { type: Date, required: true },
  rate: { type: Number, required: true, min: 0 }
});

FxRateSchema.index({ base: 1, quote: 1, date: -1 }, { unique: true });

export default mongoose.model<IFxRate>('FxRate', FxRateSchema);
