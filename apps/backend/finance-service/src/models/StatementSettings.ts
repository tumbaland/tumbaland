import mongoose, { Schema, Document } from 'mongoose';

/**
 * Per-owner settings for reading bank statements.
 *
 * Currently one thing: the names the account holder appears under. It lives
 * here rather than in the service's environment for the same reason the
 * categorisation rules do — it is one person's data, not deployment config. An
 * environment variable holds a single global value, so a second owner's
 * transfers would go undetected and there would be nowhere to put their name.
 */
export interface IStatementSettings extends Document {
  /**
   * How the account holder's name appears on a statement, in every ordering the
   * bank writes it. The bank writes it both ways depending on the channel, and
   * matching only one lets a transfer between the owner's own accounts through
   * as if it were real spending.
   *
   * Stored as plain names, not patterns — matching folds accents, ignores case
   * and collapses whitespace, so "Smith  Alex" and "SMITH ALEX" are the same
   * person and nothing the owner types is ever compiled.
   */
  ownerNames: string[];
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StatementSettingsSchema: Schema = new Schema(
  {
    ownerNames: { type: [String], default: [] },
    userId: { type: String, required: true },
    groupId: { type: String }
  },
  { timestamps: true }
);

// One document per owner, and the read is always "this owner's settings".
StatementSettingsSchema.index({ userId: 1 });
StatementSettingsSchema.index({ groupId: 1 });

export default mongoose.model<IStatementSettings>('StatementSettings', StatementSettingsSchema);
