import mongoose, { Schema, Document } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

export interface ISnapshotEntry {
  assetClassId: string;
  value: number;
  gain: number;
}

/**
 * One net-worth check-in per month: the value (and cumulative gain) of every
 * asset class on the first of that month. Replaces the old AssetAllocation
 * model, which stored each class/month pair as a separate document.
 */
export interface ISnapshot extends Document {
  date: Date; // normalized to the first of the month, UTC midnight
  entries: ISnapshotEntry[];
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SnapshotEntrySchema = new Schema<ISnapshotEntry>({
  assetClassId: { type: String, required: true },
  value: { type: Number, required: true, min: 0 },
  gain: { type: Number, required: true, default: 0 }
}, { _id: false });

const SnapshotSchema: Schema = new Schema({
  date: { type: Date, required: true },
  entries: { type: [SnapshotEntrySchema], required: true },
  userId: { type: String, required: true, index: true },
  groupId: { type: String, index: true }
}, {
  timestamps: true
});

// One snapshot per owner per month
SnapshotSchema.index({ userId: 1, groupId: 1, date: 1 }, { unique: true });

// Attribution and a change trail; see auditPlugin.
SnapshotSchema.plugin(auditPlugin, { resource: 'snapshot' });

export default mongoose.model<ISnapshot>('Snapshot', SnapshotSchema);
