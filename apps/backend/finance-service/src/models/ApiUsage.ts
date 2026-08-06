import mongoose, { Schema, Document } from 'mongoose';

/**
 * Calls spent against a rate-limited external provider on a given UTC day.
 *
 * Kept in Mongo rather than in process memory so the count survives restarts
 * and stays correct when more than one service instance is running — both of
 * which would otherwise let the service blow through a daily quota silently.
 */
export interface IApiUsage extends Document {
  provider: string;
  date: string; // YYYY-MM-DD, UTC
  count: number;
}

const ApiUsageSchema: Schema = new Schema({
  provider: { type: String, required: true },
  date: { type: String, required: true },
  count: { type: Number, required: true, default: 0 }
});

ApiUsageSchema.index({ provider: 1, date: 1 }, { unique: true });

export default mongoose.model<IApiUsage>('ApiUsage', ApiUsageSchema);
