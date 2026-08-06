import mongoose, { Schema, Document } from 'mongoose';

/**
 * A recurring monthly ceiling for one spending category. Deliberately not
 * per-month: a budget that had to be re-entered every month would be stale by
 * the second month, and month-specific overrides can be layered on later
 * without changing what is stored here.
 */
export interface IBudget extends Document {
  category: string;
  amount: number;
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema: Schema = new Schema(
  {
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    userId: { type: String, required: true },
    groupId: { type: String }
  },
  { timestamps: true }
);

// One budget per category per owner
BudgetSchema.index({ userId: 1, groupId: 1, category: 1 }, { unique: true });

export default mongoose.model<IBudget>('Budget', BudgetSchema);
