import {
  AuditEvent,
  BadRequestError,
  PERSONAL_TENANT,
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  logger
} from '@tumbaland/backend-core';
import { AssistantProviderKey, type IAssistantProviderKey } from '../models/AssistantProviderKey';
import { ChatBot } from '../models/ChatBot';
import type { Caller } from './accessService';
import { createAnthropic } from './anthropicClient';
import { MODEL_IDS, isModelId, modelCatalog, type ModelId } from './assistantModels';
import { sendToUsers } from './pushService';

/**
 * The Anthropic key and the models on offer, as admin manages them.
 *
 * The key is write-only. It goes in sealed, comes out only inside this service
 * when a reply needs it, and the admin page ever sees its last four characters.
 * It is checked against Anthropic when it is saved, so a mistyped or revoked key
 * is refused on the spot and not on the first @mention in someone's chat.
 *
 * The expiry date is a reminder to rotate it, not a switch: Anthropic is what
 * decides whether a key still works, and a date here could only turn Claude off
 * for everyone while the key was still good. What does turn it off is Anthropic
 * refusing it, which `markKeyRejected` records and tells admin about.
 */

const KEY_PREFIX = 'sk-ant-';
/** How far ahead of the date the admin page warns, and the daily push starts. */
export const EXPIRY_WARNING_DAYS = 14;
const CACHE_MS = 60_000;
const SWEEP_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ModelSettings {
  enabled: ModelId[];
  default: ModelId;
}

export interface KeyStatus {
  configured: boolean;
  /** False when this server has no secret to seal a key with: nothing can be saved. */
  encryptionReady: boolean;
  last4: string | null;
  expiresOn: string | null;
  daysLeft: number | null;
  expiringSoon: boolean;
  status: 'ok' | 'rejected' | null;
  rejectedReason: string | null;
  checkedAt: string | null;
  models: ModelSettings;
  catalog: ReturnType<typeof modelCatalog>;
  /** How many bots use each model, so turning one off can say how many it moves. */
  botCounts: Record<ModelId, number>;
  setBy: string | null;
  setAt: string | null;
}

const DEFAULT_MODELS: ModelSettings = { enabled: [...MODEL_IDS], default: 'claude-sonnet-5-5' };

const today = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

/** Whole days from today to a YYYY-MM-DD date. Zero on the day itself, negative after it. */
export function daysUntil(day: string, now: Date = new Date()): number {
  return Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today(now)}T00:00:00Z`)) / DAY_MS);
}

// Round-tripped, because Date.parse reads 2027-02-30 as the second of March.
const isDay = (value: string): boolean => {
  const at = Date.parse(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(at) && new Date(at).toISOString().slice(0, 10) === value;
};

async function count(): Promise<Record<ModelId, number>> {
  const rows = await ChatBot.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$modelId', n: { $sum: 1 } } }]);
  const counts = Object.fromEntries(MODEL_IDS.map((id) => [id, 0])) as Record<ModelId, number>;
  for (const row of rows) if (isModelId(row._id)) counts[row._id] = row.n;
  return counts;
}

/** Which models bots may use and which is the default, whether or not a key is saved yet. */
export async function getModelSettings(): Promise<ModelSettings> {
  const doc = await AssistantProviderKey.findOne({ provider: 'anthropic' }).select('models');
  return doc ? { enabled: doc.models.enabled, default: doc.models.default } : DEFAULT_MODELS;
}

export async function getKeyStatus(): Promise<KeyStatus> {
  const doc = await AssistantProviderKey.findOne({ provider: 'anthropic' });
  const daysLeft = doc?.expiresOn ? daysUntil(doc.expiresOn) : null;
  return {
    configured: Boolean(doc),
    encryptionReady: isEncryptionConfigured(),
    last4: doc?.last4 ?? null,
    expiresOn: doc?.expiresOn ?? null,
    daysLeft,
    expiringSoon: daysLeft !== null && daysLeft <= EXPIRY_WARNING_DAYS,
    status: doc?.status ?? null,
    rejectedReason: doc?.rejectedReason ?? null,
    checkedAt: doc?.checkedAt?.toISOString() ?? null,
    models: doc ? { enabled: doc.models.enabled, default: doc.models.default } : DEFAULT_MODELS,
    catalog: modelCatalog(),
    botCounts: await count(),
    setBy: doc?.setByName || null,
    setAt: doc?.setAt?.toISOString() ?? null
  };
}

/** Asks Anthropic whether a key works, with the cheapest call it has. */
async function checkWithAnthropic(apiKey: string): Promise<void> {
  try {
    await createAnthropic(apiKey).models.list({ limit: 1 });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 401 || status === 403) throw new BadRequestError('Anthropic did not accept that key');
    logger.warn('Could not check the Anthropic key', { error: (error as Error).message, status });
    throw new BadRequestError('Could not reach Anthropic to check that key. Try again in a moment.');
  }
}

export interface SaveKeyInput {
  /** Absent keeps the stored key and changes only the rest. */
  apiKey?: string;
  models?: ModelSettings;
  /** `null` clears it; absent keeps it. */
  expiresOn?: string | null;
}

function checkedModels(models: ModelSettings): ModelSettings {
  const enabled = [...new Set(models.enabled)].filter(isModelId);
  if (enabled.length === 0) throw new BadRequestError('Keep at least one model turned on');
  if (!enabled.includes(models.default)) throw new BadRequestError('The default model has to be one that is turned on');
  return { enabled, default: models.default };
}

const audit = (person: Caller, action: 'create' | 'update' | 'delete', changes: Record<string, { from: unknown; to: unknown }>) =>
  // The key is never in here, only its last four characters.
  AuditEvent.create({
    service: 'chat-service',
    action,
    resource: 'assistant_key',
    resourceId: 'anthropic',
    actorKind: 'person',
    userId: person.id,
    actorLabel: person.name || person.email,
    tenant: PERSONAL_TENANT,
    changes
  });

let cache: { at: number; value: ActiveKey | null } | null = null;

export const resetKeyCache = (): void => {
  cache = null;
};

export async function saveKey(person: Caller, input: SaveKeyInput): Promise<KeyStatus> {
  const existing = await AssistantProviderKey.findOne({ provider: 'anthropic' });
  if (!input.apiKey && !existing) throw new BadRequestError('Paste an API key to get started');

  const models = checkedModels(input.models ?? (existing ? { enabled: existing.models.enabled, default: existing.models.default } : DEFAULT_MODELS));

  const expiresOn = input.expiresOn === undefined ? (existing?.expiresOn ?? null) : input.expiresOn;
  if (expiresOn !== null) {
    if (!isDay(expiresOn)) throw new BadRequestError('The expiry date has to be a date');
    if (daysUntil(expiresOn) < 0) throw new BadRequestError('The expiry date is in the past');
  }

  const set: Partial<IAssistantProviderKey> = {
    models,
    expiresOn,
    setBy: person.id,
    setByName: person.name || person.email,
    setAt: new Date()
  };

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (input.apiKey) {
    const apiKey = input.apiKey.trim();
    if (!apiKey.startsWith(KEY_PREFIX) || apiKey.length < 20) throw new BadRequestError('That does not look like an Anthropic API key');
    // Sealing needs the server's secret; refuse before spending a call on a key we could not keep.
    if (!isEncryptionConfigured()) throw new BadRequestError('This server has no encryption secret, so it cannot keep a key');
    await checkWithAnthropic(apiKey);
    Object.assign(set, encryptSecret(apiKey), {
      last4: apiKey.slice(-4),
      status: 'ok',
      rejectedReason: null,
      checkedAt: new Date(),
      // A new key restarts the reminders: it has its own date.
      expiryWarnedOn: null
    });
    changes.key = { from: existing ? `…${existing.last4}` : null, to: `…${apiKey.slice(-4)}` };
  }
  if ((existing?.expiresOn ?? null) !== expiresOn) changes.expiresOn = { from: existing?.expiresOn ?? null, to: expiresOn };
  if (existing && JSON.stringify(existing.models.enabled) !== JSON.stringify(models.enabled)) {
    changes.enabledModels = { from: existing.models.enabled, to: models.enabled };
  }
  if (existing && existing.models.default !== models.default) {
    changes.defaultModel = { from: existing.models.default, to: models.default };
  }

  await AssistantProviderKey.findOneAndUpdate({ provider: 'anthropic' }, { $set: set }, { upsert: true, setDefaultsOnInsert: true });
  resetKeyCache();
  if (Object.keys(changes).length > 0) await audit(person, existing ? 'update' : 'create', changes);
  return getKeyStatus();
}

/**
 * Asks Anthropic about the key already saved, and puts it back to work if it is
 * accepted. One 401 marks a key rejected, and a 401 can also be Anthropic having
 * a bad minute: without this, the only way back would be pasting the key again.
 */
export async function recheckKey(person: Caller): Promise<KeyStatus> {
  const doc = await AssistantProviderKey.findOne({ provider: 'anthropic' });
  if (!doc) throw new BadRequestError('There is no key to check');
  let apiKey: string;
  try {
    apiKey = decryptSecret({ ciphertext: doc.ciphertext, iv: doc.iv, tag: doc.tag });
  } catch {
    throw new BadRequestError('The saved key cannot be opened on this server. Paste it again.');
  }
  try {
    await checkWithAnthropic(apiKey);
  } catch (error) {
    await AssistantProviderKey.updateOne({ _id: doc._id }, { $set: { status: 'rejected', rejectedReason: (error as Error).message, checkedAt: new Date() } });
    resetKeyCache();
    throw error;
  }
  await AssistantProviderKey.updateOne({ _id: doc._id }, { $set: { status: 'ok', rejectedReason: null, checkedAt: new Date() } });
  resetKeyCache();
  if (doc.status !== 'ok') await audit(person, 'update', { status: { from: doc.status, to: 'ok' } });
  return getKeyStatus();
}

export async function removeKey(person: Caller): Promise<KeyStatus> {
  const existing = await AssistantProviderKey.findOneAndDelete({ provider: 'anthropic' });
  resetKeyCache();
  if (existing) await audit(person, 'delete', { key: { from: `…${existing.last4}`, to: null } });
  return getKeyStatus();
}

export interface ActiveKey {
  apiKey: string;
  models: ModelSettings;
}

/**
 * The key to call Claude with, or null when there is none worth trying: not
 * saved, rejected by Anthropic, or not openable on this server. Kept in memory
 * for a minute so a busy chat does not read and decrypt it for every reply.
 */
export async function getActiveKey(): Promise<ActiveKey | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  const doc = await AssistantProviderKey.findOne({ provider: 'anthropic' });
  let value: ActiveKey | null = null;
  if (doc && doc.status === 'ok') {
    try {
      value = {
        apiKey: decryptSecret({ ciphertext: doc.ciphertext, iv: doc.iv, tag: doc.tag }),
        models: { enabled: doc.models.enabled, default: doc.models.default }
      };
    } catch (error) {
      logger.error('The stored Anthropic key could not be opened', { error: (error as Error).message });
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

/** Anthropic refused the key: stop trying, and tell the person who set it. */
export async function markKeyRejected(reason: string): Promise<void> {
  const doc = await AssistantProviderKey.findOneAndUpdate(
    { provider: 'anthropic', status: 'ok' },
    { $set: { status: 'rejected', rejectedReason: reason.slice(0, 200), checkedAt: new Date() } }
  );
  resetKeyCache();
  if (!doc) return;
  logger.error('Anthropic rejected the assistant key', { reason });
  await sendToUsers([doc.setBy], {
    title: 'Claude key rejected',
    body: 'Anthropic is no longer accepting the key the chat assistants use.',
    tag: 'assistant-key',
    url: '/admin/claude'
  }).catch(() => undefined);
}

/** Once a day, from two weeks out: nudge whoever set the key to replace it. */
export async function warnIfExpiring(now: Date = new Date()): Promise<boolean> {
  const doc = await AssistantProviderKey.findOne({ provider: 'anthropic' });
  if (!doc?.expiresOn || doc.expiryWarnedOn === today(now)) return false;
  const left = daysUntil(doc.expiresOn, now);
  if (left > EXPIRY_WARNING_DAYS) return false;

  await AssistantProviderKey.updateOne({ _id: doc._id }, { $set: { expiryWarnedOn: today(now) } });
  await sendToUsers([doc.setBy], {
    title: 'Claude key expiring',
    body: left < 0 ? 'The key the chat assistants use is past its expiry date.' : left === 0 ? 'The key the chat assistants use expires today.' : `The key the chat assistants use expires in ${left} day${left === 1 ? '' : 's'}.`,
    tag: 'assistant-key-expiry',
    url: '/admin/claude'
  }).catch(() => undefined);
  return true;
}

export function startKeyExpirySweep(): () => void {
  const timer = setInterval(() => {
    void warnIfExpiring().catch((error: Error) => logger.warn('Key expiry check failed', { error: error.message }));
  }, SWEEP_MS);
  timer.unref();
  return () => clearInterval(timer);
}
