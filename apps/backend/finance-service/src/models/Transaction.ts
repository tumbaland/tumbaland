import mongoose, { Schema, Document } from 'mongoose';
import { auditPlugin } from '@tumbaland/backend-core';

export type TransactionType = 'income' | 'expense';

/**
 * One cash movement. Net-worth snapshots say *what* changed month to month;
 * these say *why* — whether a rise came from money saved or from the market.
 *
 * `amount` is always a positive magnitude; `type` carries the direction, so a
 * sign error cannot silently turn an expense into income.
 */
export interface ITransaction extends Document {
  date: Date;
  amount: number;
  type: TransactionType;
  category: string;
  note?: string;
  /**
   * Stable id from the source system for imported rows (a bank's archive
   * reference). Set only by import scripts, never through the API, so a
   * re-import updates the row it created last time instead of duplicating it.
   */
  externalId?: string;
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, required: true, enum: ['income', 'expense'] },
    category: { type: String, required: true, trim: true },
    note: { type: String },
    externalId: { type: String },
    userId: { type: String, required: true },
    groupId: { type: String }
  },
  { timestamps: true }
);

// Reads are "this owner's transactions over a date range", newest first.
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ groupId: 1, date: -1 });
// Partial, so the uniqueness applies only to imported rows and the many
// hand-entered ones (which carry no externalId) are unaffected.
TransactionSchema.index(
  { userId: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $exists: true } } }
);

// Attribution and a change trail; see auditPlugin.
TransactionSchema.plugin(auditPlugin, { resource: 'transaction' });

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
