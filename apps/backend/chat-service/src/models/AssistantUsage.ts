import { Schema, model, Document } from 'mongoose';

export type AssistantOutcome = 'ok' | 'refused' | 'error' | 'key_rejected';

/**
 * One row per attempt to answer, whoever it ended up costing.
 *
 * The allowance itself is the `assistantSpend` meter in backend-core, which is
 * what plans, overrides and the nightly report already read. This is the detail
 * behind it: which bot, which model, how many tokens, how long, and how it
 * ended. It answers "who is spending what" on the admin page, and it is what
 * the per-minute and per-day caps count.
 */
export interface IAssistantUsage extends Document {
  conversationId: string;
  groupId: string;
  botId: string;
  botName: string;
  /** Who it was charged to: the person who mentioned the bot. */
  mentionerId: string;
  mentionerEmail: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** In `assistantSpend` units, a ten-thousandth of a dollar each. */
  units: number;
  durationMs: number;
  outcome: AssistantOutcome;
  /** Spoke up without being asked, on its owner's allowance; `mentioner` is then the owner. */
  unasked: boolean;
  createdAt: Date;
}

const AssistantUsageSchema = new Schema<IAssistantUsage>(
  {
    conversationId: { type: String, required: true },
    groupId: { type: String, required: true },
    botId: { type: String, required: true },
    botName: { type: String, default: '' },
    mentionerId: { type: String, required: true },
    mentionerEmail: { type: String, required: true, lowercase: true },
    modelId: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheWriteTokens: { type: Number, default: 0 },
    units: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    outcome: { type: String, enum: ['ok', 'refused', 'error', 'key_rejected'], required: true },
    unasked: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// The per-person caps, and "my usage".
AssistantUsageSchema.index({ mentionerId: 1, createdAt: -1 });
// The admin page: this month, across everyone.
AssistantUsageSchema.index({ createdAt: -1 });

export const AssistantUsage = model<IAssistantUsage>('AssistantUsage', AssistantUsageSchema);
