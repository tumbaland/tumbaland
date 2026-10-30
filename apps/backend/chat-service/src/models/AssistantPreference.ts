import { Schema, model, Document } from 'mongoose';

/**
 * A person's own settings for assistants, across every chat they are in.
 *
 * Only a lower cap for now: "stop at half of my allowance". Never a higher one
 * than the plan gives; that is not theirs to set.
 */
export interface IAssistantPreference extends Document {
  userId: string;
  /** 10 to 100: the share of their monthly allowance they are willing to spend. Null is no cap of their own. */
  capPercent: number | null;
}

const AssistantPreferenceSchema = new Schema<IAssistantPreference>(
  {
    userId: { type: String, required: true, unique: true },
    capPercent: { type: Number, min: 10, max: 100, default: null }
  },
  { timestamps: true }
);

export const AssistantPreference = model<IAssistantPreference>('AssistantPreference', AssistantPreferenceSchema);
