import mongoose, { Schema, Document } from 'mongoose';
import { TransactionType } from './Transaction';

export type MatchType = 'text' | 'regex';

/**
 * A categorisation, owned and editable.
 *
 * The rules used to be a fixed array in `bankStatement.service`, compiled into
 * the image: one person's merchants, employers and bank, unreachable from the
 * app. Correcting a transaction only rewrote rows that already existed, so the
 * next import of the same merchant landed in Uncategorised again and the
 * backlog came back every month. These close that loop — a correction becomes a
 * standing instruction, and the shipped list is data that can be edited rather
 * than a deploy.
 */
export interface ICategoryRule extends Document {
  /** What to look for in the counterparty and description. */
  pattern: string;
  /**
   * How `pattern` is read.
   *
   * `text` is a diacritic-folded, case-insensitive substring test — what a
   * counterparty name actually needs, readable to whoever wrote it, and with
   * nothing for the server to compile. It is what the UI writes.
   *
   * `regex` exists because the exported built-ins need it: rules like
   * `\bBOLT\b(?! ?Food)` carry exceptions no substring can express — flatten
   * that one and every Bolt Food order refiles itself as Transport.
   */
  matchType: MatchType;
  category: string;
  /**
   * Restricts the rule to one direction. A counterparty can be both — a bank
   * that pays your wages and also holds your deposits — and without this the
   * first rule written for the name claims both legs.
   */
  type?: TransactionType;
  /** Lower runs first, so a specific rule can be ordered ahead of a broad one. */
  priority: number;
  /** Why the rule is written the way it is — worth reading before editing one. */
  note?: string;
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryRuleSchema: Schema = new Schema(
  {
    pattern: { type: String, required: true, trim: true },
    matchType: { type: String, enum: ['text', 'regex'], default: 'text', required: true },
    category: { type: String, required: true, trim: true },
    type: { type: String, enum: ['income', 'expense'] },
    priority: { type: Number, required: true, default: 0 },
    note: { type: String },
    userId: { type: String, required: true },
    groupId: { type: String }
  },
  { timestamps: true }
);

// Every read is "this owner's rules, in the order they run".
CategoryRuleSchema.index({ userId: 1, priority: 1 });
CategoryRuleSchema.index({ groupId: 1, priority: 1 });

export default mongoose.model<ICategoryRule>('CategoryRule', CategoryRuleSchema);
