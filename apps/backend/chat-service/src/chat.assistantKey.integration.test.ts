process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';
process.env.API_KEY_ENCRYPTION_SECRET = 'a-secret-long-enough-to-seal-keys-with';

/**
 * The Claude page in admin-front: the Anthropic key, the models on offer and
 * what people spend. Through the real middleware, controllers and database;
 * Anthropic and push are replaced.
 */
jest.mock('./services/anthropicClient', () => ({ createAnthropic: jest.fn() }));
jest.mock('./services/pushService', () => ({
  ...jest.requireActual('./services/pushService'),
  sendToUsers: jest.fn(async () => 1)
}));
jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getEntitlements: jest.fn()
}));

import { AuditEvent, getEntitlements, normalizeLimits, resetEncryptionKeyCache } from '@tumbaland/backend-core';
import { as, TOM, setupChatIntegration, conversationInG1 } from './test/integration';
import { createAnthropic } from './services/anthropicClient';
import { sendToUsers } from './services/pushService';
import { AssistantProviderKey } from './models/AssistantProviderKey';
import { AssistantUsage, type IAssistantUsage } from './models/AssistantUsage';
import { ChatBot } from './models/ChatBot';
import { getActiveKey, markKeyRejected, resetKeyCache, warnIfExpiring, daysUntil } from './services/assistantKeyService';

setupChatIntegration();

const ADMIN = { ...TOM, id: 'u-admin', email: 'admin@example.com', name: 'Ada', roles: ['admin'] } as typeof TOM;
const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789WXYZ';
const list = jest.fn();
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

beforeEach(() => {
  list.mockReset().mockResolvedValue({ data: [] });
  (createAnthropic as jest.Mock).mockReset().mockReturnValue({ models: { list } });
  (getEntitlements as jest.Mock).mockImplementation(async (email: string) => ({
    email,
    planCode: 'free',
    status: null,
    limits: normalizeLimits({ meters: { assistantSpend: 5000 } }, 'free')
  }));
  process.env.API_KEY_ENCRYPTION_SECRET = 'a-secret-long-enough-to-seal-keys-with';
  resetEncryptionKeyCache();
  resetKeyCache();
});

const save = (body: object, user = ADMIN) => as(user).put('/api/chat/admin/assistant-key').send(body);

describe('who may open the Claude page', () => {
  it('is for administrators only', async () => {
    expect((await as(TOM).get('/api/chat/admin/assistant-key')).status).toBe(403);
    expect((await as(TOM).put('/api/chat/admin/assistant-key').send({ apiKey: KEY })).status).toBe(403);
    expect((await as(TOM).delete('/api/chat/admin/assistant-key')).status).toBe(403);
    expect((await as(TOM).get('/api/chat/admin/assistant-usage')).status).toBe(403);
  });

  it('is not the conversation route that would read "admin" as an id', async () => {
    const res = await as(ADMIN).get('/api/chat/admin/assistant-key');
    expect(res.status).toBe(200);
  });
});

describe('before anything is saved', () => {
  it('says so, offers every model and is ready to seal a key', async () => {
    const { data } = (await as(ADMIN).get('/api/chat/admin/assistant-key')).body;
    expect(data).toMatchObject({
      configured: false,
      encryptionReady: true,
      last4: null,
      status: null,
      models: { enabled: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'], default: 'claude-sonnet-5-5' }
    });
    expect(data.catalog.map((model: { label: string }) => model.label)).toEqual(['Fast', 'Balanced', 'Best']);
  });

  it('will not save models with no key to go with them', async () => {
    const res = await save({ models: { enabled: ['claude-haiku-5-5'], default: 'claude-haiku-5-5' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Paste an API key/);
  });
});

describe('saving the key', () => {
  it('checks it with Anthropic, keeps it sealed, and never gives it back', async () => {
    const res = await save({ apiKey: KEY, expiresOn: day(60) });

    expect(res.status).toBe(200);
    expect(createAnthropic).toHaveBeenCalledWith(KEY);
    expect(list).toHaveBeenCalledWith({ limit: 1 });
    expect(res.body.data).toMatchObject({ configured: true, last4: 'WXYZ', status: 'ok', setBy: 'Ada', expiringSoon: false });
    // Nowhere in what comes back, and not in the clear in the database.
    expect(JSON.stringify(res.body)).not.toContain(KEY);
    expect(JSON.stringify(res.body)).not.toContain('ciphertext');
    const stored = await AssistantProviderKey.findOne();
    expect(JSON.stringify(stored)).not.toContain(KEY);
    expect((await as(ADMIN).get('/api/chat/admin/assistant-key')).body.data.last4).toBe('WXYZ');
  });

  it('can open it again to call Claude with', async () => {
    await save({ apiKey: KEY });
    expect((await getActiveKey())?.apiKey).toBe(KEY);
  });

  it('writes down that it was set, with the last four characters and never the key', async () => {
    await save({ apiKey: KEY, expiresOn: day(60) });
    const events = await AuditEvent.find({ resource: 'assistant_key' });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: 'create', userId: 'u-admin', actorLabel: 'Ada', service: 'chat-service' });
    expect(JSON.stringify(events[0])).not.toContain(KEY);
    expect(events[0]!.changes).toMatchObject({ key: { from: null, to: '…WXYZ' } });
  });

  it('refuses a key Anthropic does not accept, and keeps the one it had', async () => {
    await save({ apiKey: KEY });
    list.mockRejectedValue(Object.assign(new Error('invalid x-api-key'), { status: 401 }));

    const res = await save({ apiKey: 'sk-ant-api03-this-one-is-no-good-0000' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Anthropic did not accept that key');
    expect((await getActiveKey())?.apiKey).toBe(KEY);
  });

  it('says so when Anthropic cannot be reached, instead of calling the key bad', async () => {
    list.mockRejectedValue(Object.assign(new Error('socket hang up'), { status: 503 }));
    const res = await save({ apiKey: KEY });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Could not reach Anthropic/);
    expect(await AssistantProviderKey.countDocuments()).toBe(0);
  });

  it('refuses something that is not an Anthropic key without asking Anthropic', async () => {
    const res = await save({ apiKey: 'not-a-key-at-all-just-some-text' });
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('refuses when this server has nothing to seal a key with', async () => {
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    const res = await save({ apiKey: KEY });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no encryption secret/);
    expect((await as(ADMIN).get('/api/chat/admin/assistant-key')).body.data.encryptionReady).toBe(false);
  });

  it('swaps in a new key at once, with no wait for the cache', async () => {
    await save({ apiKey: KEY });
    expect((await getActiveKey())?.apiKey).toBe(KEY);
    const next = 'sk-ant-api03-replacement-key-for-the-test-ABCD';
    await save({ apiKey: next });
    expect((await getActiveKey())?.apiKey).toBe(next);
    expect((await AuditEvent.find({ resource: 'assistant_key' })).map((event) => event.action).sort()).toEqual(['create', 'update']);
  });

  it('rejects nothing-to-change and an empty body', async () => {
    expect((await save({})).status).toBe(400);
  });
});

describe('models', () => {
  beforeEach(async () => {
    await save({ apiKey: KEY });
  });

  it('turns models on and off and picks the default, without needing the key again', async () => {
    const res = await save({ models: { enabled: ['claude-haiku-5-5', 'claude-sonnet-5-5'], default: 'claude-haiku-5-5' } });
    expect(res.status).toBe(200);
    expect(res.body.data.models).toEqual({ enabled: ['claude-haiku-5-5', 'claude-sonnet-5-5'], default: 'claude-haiku-5-5' });
    expect(list).toHaveBeenCalledTimes(1);
    expect((await getActiveKey())?.apiKey).toBe(KEY);
    const events = await AuditEvent.find({ resource: 'assistant_key', action: 'update' });
    expect(events[0]!.changes).toMatchObject({ enabledModels: expect.anything(), defaultModel: expect.anything() });
  });

  it('will not leave no model on, or a default that is off', async () => {
    expect((await save({ models: { enabled: [], default: 'claude-haiku-5-5' } })).status).toBe(400);
    const res = await save({ models: { enabled: ['claude-haiku-5-5'], default: 'claude-opus-5-5' } });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/default model has to be one that is turned on/);
  });

  it('says how many bots use each, so turning one off can say how many it moves', async () => {
    const id = await conversationInG1();
    await ChatBot.create({ conversationId: id, ownerId: 'u-tom', name: 'Tumbi', modelId: 'claude-opus-5-5' });
    await ChatBot.create({ conversationId: id, ownerId: 'u-irja', name: 'Bubu', modelId: 'claude-opus-5-5' });
    const { data } = (await as(ADMIN).get('/api/chat/admin/assistant-key')).body;
    expect(data.botCounts).toEqual({ 'claude-haiku-5-5': 0, 'claude-sonnet-5-5': 0, 'claude-opus-5-5': 2 });
  });
});

describe('the expiry date', () => {
  it('is a reminder: the key keeps working on and after the day', async () => {
    await save({ apiKey: KEY, expiresOn: day(0) });
    expect((await getActiveKey())?.apiKey).toBe(KEY);
  });

  it('warns from two weeks out', async () => {
    const far = (await save({ apiKey: KEY, expiresOn: day(40) })).body.data;
    expect(far).toMatchObject({ daysLeft: 40, expiringSoon: false });
    const near = (await save({ expiresOn: day(10) })).body.data;
    expect(near).toMatchObject({ daysLeft: 10, expiringSoon: true });
  });

  it('can be cleared, and refuses a date in the past or a non-date', async () => {
    await save({ apiKey: KEY, expiresOn: day(10) });
    expect((await save({ expiresOn: null })).body.data.expiresOn).toBeNull();
    expect((await save({ expiresOn: day(-1) })).body.message).toMatch(/in the past/);
    expect((await save({ expiresOn: '2027-02-30' })).status).toBe(400);
    expect((await save({ expiresOn: 'tomorrow' })).status).toBe(400);
  });

  it('counts whole days', () => {
    const now = new Date('2026-10-30T23:59:00Z');
    expect(daysUntil('2026-10-30', now)).toBe(0);
    expect(daysUntil('2026-11-01', now)).toBe(2);
    expect(daysUntil('2026-10-29', now)).toBe(-1);
  });

  it('tells whoever set the key, once a day, from two weeks out', async () => {
    await save({ apiKey: KEY, expiresOn: day(10) });
    expect(await warnIfExpiring()).toBe(true);
    expect(sendToUsers).toHaveBeenCalledWith(['u-admin'], expect.objectContaining({ title: 'Claude key expiring', body: expect.stringContaining('10 days') }));
    expect(await warnIfExpiring()).toBe(false);
    expect(sendToUsers).toHaveBeenCalledTimes(1);
  });

  it('does not nag about a date far off, or when there is none', async () => {
    await save({ apiKey: KEY, expiresOn: day(60) });
    expect(await warnIfExpiring()).toBe(false);
    await save({ expiresOn: null });
    expect(await warnIfExpiring()).toBe(false);
  });

  it('words the day itself and the day after', async () => {
    await save({ apiKey: KEY, expiresOn: day(0) });
    await warnIfExpiring();
    expect(sendToUsers).toHaveBeenLastCalledWith(['u-admin'], expect.objectContaining({ body: expect.stringContaining('expires today') }));
    await AssistantProviderKey.updateOne({}, { $set: { expiresOn: day(-2), expiryWarnedOn: null } });
    await warnIfExpiring();
    expect(sendToUsers).toHaveBeenLastCalledWith(['u-admin'], expect.objectContaining({ body: expect.stringContaining('past its expiry') }));
    await AssistantProviderKey.updateOne({}, { $set: { expiresOn: day(1), expiryWarnedOn: null } });
    await warnIfExpiring();
    expect(sendToUsers).toHaveBeenLastCalledWith(['u-admin'], expect.objectContaining({ body: expect.stringContaining('1 day.') }));
  });
});

describe('when Anthropic stops accepting the key', () => {
  it('stops using it and tells whoever set it, until a new key comes', async () => {
    await save({ apiKey: KEY });
    await markKeyRejected('Anthropic answered 401');

    expect(await getActiveKey()).toBeNull();
    const { data } = (await as(ADMIN).get('/api/chat/admin/assistant-key')).body;
    expect(data).toMatchObject({ status: 'rejected', rejectedReason: 'Anthropic answered 401' });
    expect(sendToUsers).toHaveBeenCalledWith(['u-admin'], expect.objectContaining({ title: 'Claude key rejected' }));

    await save({ apiKey: 'sk-ant-api03-the-new-key-after-the-old-one-0000' });
    expect((await as(ADMIN).get('/api/chat/admin/assistant-key')).body.data.status).toBe('ok');
    expect(await getActiveKey()).not.toBeNull();
  });

  it('is told once, however many replies find it out', async () => {
    await save({ apiKey: KEY });
    await markKeyRejected('first');
    await markKeyRejected('second');
    expect(sendToUsers).toHaveBeenCalledTimes(1);
  });

  it('has nothing to do when there is no key', async () => {
    await markKeyRejected('nothing saved');
    expect(sendToUsers).not.toHaveBeenCalled();
  });
});

describe('checking the saved key again', () => {
  const check = (user = ADMIN) => as(user).post('/api/chat/admin/assistant-key/check');

  it('puts a rejected key back to work when Anthropic accepts it now, and writes that down', async () => {
    await save({ apiKey: KEY });
    await markKeyRejected('Anthropic answered 401');
    expect(await getActiveKey()).toBeNull();

    const res = await check();

    expect(res.body.data).toMatchObject({ status: 'ok', rejectedReason: null });
    expect(createAnthropic).toHaveBeenLastCalledWith(KEY);
    expect((await getActiveKey())?.apiKey).toBe(KEY);
    const changed = await AuditEvent.find({ resource: 'assistant_key', action: 'update' });
    expect(changed.at(-1)!.changes).toEqual({ status: { from: 'rejected', to: 'ok' } });
  });

  it('keeps it rejected, with the reason, when Anthropic still refuses it', async () => {
    await save({ apiKey: KEY });
    list.mockRejectedValue(Object.assign(new Error('invalid x-api-key'), { status: 401 }));

    const res = await check();

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Anthropic did not accept that key');
    const { data } = (await as(ADMIN).get('/api/chat/admin/assistant-key')).body;
    expect(data).toMatchObject({ status: 'rejected', rejectedReason: 'Anthropic did not accept that key' });
    expect(await getActiveKey()).toBeNull();
  });

  it('needs a key, one this server can open, and an administrator', async () => {
    expect((await check()).body.message).toBe('There is no key to check');
    await save({ apiKey: KEY });
    expect((await check(TOM)).status).toBe(403);
    await AssistantProviderKey.updateOne({}, { $set: { ciphertext: 'AAAA' } });
    expect((await check()).body.message).toMatch(/cannot be opened/);
  });

  it('writes nothing down when the key was fine already', async () => {
    await save({ apiKey: KEY });
    await check();
    expect(await AuditEvent.countDocuments({ resource: 'assistant_key', action: 'update' })).toBe(0);
  });
});

describe('removing the key', () => {
  it('leaves nothing to call Claude with, and writes it down', async () => {
    await save({ apiKey: KEY });
    const res = await as(ADMIN).delete('/api/chat/admin/assistant-key');

    expect(res.body.data.configured).toBe(false);
    expect(await getActiveKey()).toBeNull();
    expect(await AssistantProviderKey.countDocuments()).toBe(0);
    expect((await AuditEvent.find({ resource: 'assistant_key', action: 'delete' }))[0]!.changes).toMatchObject({ key: { from: '…WXYZ', to: null } });
  });

  it('is fine when there is none to remove', async () => {
    expect((await as(ADMIN).delete('/api/chat/admin/assistant-key')).status).toBe(200);
  });
});

describe('a stored key that cannot be opened', () => {
  it('is treated as no key rather than failing every reply', async () => {
    await save({ apiKey: KEY });
    await AssistantProviderKey.updateOne({}, { $set: { ciphertext: 'AAAA' } });
    resetKeyCache();
    expect(await getActiveKey()).toBeNull();
  });
});

describe('what people spend', () => {
  const row = (overrides: Partial<IAssistantUsage>): Partial<IAssistantUsage> => ({
    conversationId: 'c1',
    groupId: 'g1',
    botId: 'b1',
    botName: 'Tumbi',
    mentionerId: 'u-tom',
    mentionerEmail: 'tom@example.com',
    modelId: 'claude-sonnet-5-5',
    units: 400,
    outcome: 'ok',
    ...overrides
  });

  it('adds up the month by model, person and chat, most expensive first', async () => {
    await AssistantUsage.create([
      row({ units: 400 }),
      row({ units: 1000, modelId: 'claude-opus-5-5' }),
      row({ units: 100, mentionerId: 'u-irja', mentionerEmail: 'irja@example.com', conversationId: 'c2', outcome: 'error' })
    ]);

    const { data } = (await as(ADMIN).get('/api/chat/admin/assistant-usage')).body;

    expect(data.totals).toEqual({ replies: 3, failed: 1, units: 1500 });
    expect(data.byModel.map((entry: { model: string }) => entry.model)).toEqual(['claude-opus-5-5', 'claude-sonnet-5-5']);
    expect(data.byPerson[0]).toMatchObject({ email: 'tom@example.com', replies: 2, units: 1400, limit: 5000, percent: 0 });
    expect(data.byChat.map((entry: { conversationId: string }) => entry.conversationId)).toEqual(['c1', 'c2']);
  });

  it('answers a month with nothing in it', async () => {
    const { data } = (await as(ADMIN).get('/api/chat/admin/assistant-usage?month=2020-01')).body;
    expect(data).toMatchObject({ month: '2020-01', totals: { replies: 0, failed: 0, units: 0 }, byPerson: [] });
  });

  it('refuses a month that is not one', async () => {
    expect((await as(ADMIN).get('/api/chat/admin/assistant-usage?month=October')).status).toBe(400);
    expect((await as(ADMIN).get('/api/chat/admin/assistant-usage?month=2026-13')).status).toBe(400);
  });
});
