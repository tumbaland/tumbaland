import { Schema, model, Document } from 'mongoose';
import { MODEL_IDS, type ModelId } from '../services/assistantModels';

/**
 * The Anthropic API key Tumbaland's chat assistants run on, and which models
 * they may use. One document: there is one key.
 *
 * The key is sealed with the same AES-256-GCM secret the API keys use and is
 * never read back out to a client; only `last4` is. It lives here and not in
 * admin-service because this is the service that calls Claude, and admin-service
 * reads other services' data without ever writing it.
 */
export interface IAssistantProviderKey extends Document {
  provider: 'anthropic';
  ciphertext: string;
  iv: string;
  tag: string;
  /** The last four characters, enough to tell two keys apart on the admin page. */
  last4: string;
  /** YYYY-MM-DD. A reminder to rotate, not a cut-off: Anthropic decides when a key stops working. */
  expiresOn: string | null;
  /** `rejected` once Anthropic has answered a call with an authentication or permission error. */
  status: 'ok' | 'rejected';
  rejectedReason: string | null;
  checkedAt: Date | null;
  models: { enabled: ModelId[]; default: ModelId };
  setBy: string;
  setByName: string;
  setAt: Date;
  /** The last day a "this key is about to expire" notice was sent, so it goes once a day. */
  expiryWarnedOn: string | null;
}

const AssistantProviderKeySchema = new Schema<IAssistantProviderKey>(
  {
    provider: { type: String, enum: ['anthropic'], default: 'anthropic', unique: true },
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    last4: { type: String, required: true },
    expiresOn: { type: String, default: null },
    status: { type: String, enum: ['ok', 'rejected'], default: 'ok' },
    rejectedReason: { type: String, default: null },
    checkedAt: { type: Date, default: null },
    models: {
      type: new Schema(
        {
          enabled: { type: [String], enum: MODEL_IDS, default: [...MODEL_IDS] },
          default: { type: String, enum: MODEL_IDS, default: 'claude-sonnet-5-5' }
        },
        { _id: false }
      ),
      default: () => ({ enabled: [...MODEL_IDS], default: 'claude-sonnet-5-5' })
    },
    setBy: { type: String, required: true },
    setByName: { type: String, default: '' },
    setAt: { type: Date, default: Date.now },
    expiryWarnedOn: { type: String, default: null }
  },
  { timestamps: true, collection: 'assistant_provider_keys' }
);

export const AssistantProviderKey = model<IAssistantProviderKey>('AssistantProviderKey', AssistantProviderKeySchema);
