process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';

/**
 * The assistants in a conversation: consent, the bots people add, and who may
 * change them. Through the real middleware, controllers and database. The group
 * roles (group-service), push and the plan are replaced.
 */
jest.mock('./services/groupRoleClient', () => ({
  isGroupManager: jest.fn(async () => false),
  groupManagers: jest.fn(async () => []),
  resetGroupRoleCache: jest.fn()
}));
jest.mock('./services/pushService', () => ({
  ...jest.requireActual('./services/pushService'),
  sendToUsers: jest.fn(async () => 1)
}));
jest.mock('@tumbaland/backend-core', () => ({
  ...jest.requireActual('@tumbaland/backend-core'),
  getEntitlements: jest.fn(),
  getGroupOwner: jest.fn()
}));

import { getEntitlements, getGroupOwner, normalizeLimits, recordUsage } from '@tumbaland/backend-core';
import { as, TOM, IRJA, PERSIK, conversationInG1, setupChatIntegration } from './test/integration';
import { isGroupManager } from './services/groupRoleClient';
import { sendToUsers } from './services/pushService';
import { subscribe } from './services/streamHub';
import { AssistantProviderKey } from './models/AssistantProviderKey';
import { ChatBot } from './models/ChatBot';
import { Message } from './models/Message';
import { assistantsOn } from './services/botService';
import { Conversation } from './models/Conversation';

setupChatIntegration();

const MARI = { id: 'u-mari', email: 'mari@example.com', name: 'Mari', groups: ['g1'] };
const url = (id: string, rest = '') => `/api/chat/conversations/${id}/assistants${rest}`;
const view = async (id: string, user = TOM) => (await as(user).get(url(id))).body.data;
const lines = async (id: string) => (await Message.find({ conversationId: id, kind: 'system' }).sort({ createdAt: 1 })).map((m) => m.body);
const makeBot = (id: string, user = TOM, body: object = { name: 'Tumbi' }) => as(user).post(url(id, '/bots')).send(body);

/** Both people have opened the chat, so both are on the roster. */
async function chatWithBoth(): Promise<string> {
  const id = await conversationInG1();
  await as(IRJA).get(`/api/chat/conversations/${id}`);
  return id;
}

beforeEach(() => {
  (getGroupOwner as jest.Mock).mockResolvedValue(null);
  (isGroupManager as jest.Mock).mockImplementation(async () => false);
  (getEntitlements as jest.Mock).mockImplementation(async (email: string) => ({
    email,
    planCode: 'free',
    status: null,
    limits: normalizeLimits({ meters: { assistantSpend: 5000 } }, 'free')
  }));
});

const asManager = (...emails: string[]) =>
  (isGroupManager as jest.Mock).mockImplementation(async (_group: string, email: string) => emails.includes(email));

describe('turning assistants on', () => {
  it('starts off', async () => {
    const id = await chatWithBoth();
    expect(await view(id)).toMatchObject({ enabled: false, lockedOff: false, whoCanAdd: 'everyone', bots: [] });
  });

  it('is one switch for the whole chat, which anyone in it can flip either way', async () => {
    const id = await chatWithBoth();

    await as(TOM).patch(url(id)).send({ enabled: true });
    expect((await view(id)).enabled).toBe(true);
    expect((await view(id, IRJA)).enabled).toBe(true);

    await as(IRJA).patch(url(id)).send({ enabled: false });
    expect((await view(id)).enabled).toBe(false);
  });

  it('says in the thread who flipped it, and only when something changed', async () => {
    const id = await chatWithBoth();
    await as(TOM).patch(url(id)).send({ enabled: true });
    await as(IRJA).patch(url(id)).send({ enabled: true });
    await as(IRJA).patch(url(id)).send({ enabled: false });
    expect(await lines(id)).toEqual(['Tom turned assistants on for this chat', 'Irja turned assistants off for this chat']);
  });

  it('stays on when someone new opens the chat, or when the group has people who never have', async () => {
    const id = await chatWithBoth();
    await as(TOM).patch(url(id)).send({ enabled: true });
    await as(MARI).get(`/api/chat/conversations/${id}`);
    (getGroupOwner as jest.Mock).mockResolvedValue({ groupId: 'g1', ownerEmail: 'tom@example.com', memberCount: 9, deleted: false });
    expect((await view(id)).enabled).toBe(true);
    expect(assistantsOn((await Conversation.findById(id))!, 9)).toBe(true);
  });

  it('reads a chat from before the switch the old way, until someone flips it', async () => {
    const id = await chatWithBoth();
    await Conversation.updateOne({ _id: id }, { $set: { 'assistants.enabledBy': ['u-tom', 'u-irja'] }, $unset: { 'assistants.on': 1 } });
    let conversation = (await Conversation.findById(id))!;
    expect(assistantsOn(conversation, 2)).toBe(true);
    expect(assistantsOn(conversation, 3)).toBe(false);

    await Conversation.updateOne({ _id: id }, { $set: { 'assistants.enabledBy': ['u-tom'] } });
    expect((await view(id)).enabled).toBe(false);
    // Turning on what was off by the old rule says so; from then on it is the switch.
    await as(IRJA).patch(url(id)).send({ enabled: true });
    expect(await lines(id)).toEqual(['Irja turned assistants on for this chat']);
    conversation = (await Conversation.findById(id))!;
    expect(conversation.assistants?.on).toBe(true);
    expect(assistantsOn(conversation, 9)).toBe(true);
  });

  it('is not on in a chat nobody has opened', () => {
    expect(assistantsOn({ members: [], assistants: undefined } as never)).toBe(false);
  });

  it('keeps people from other groups out', async () => {
    const id = await chatWithBoth();
    expect((await as(PERSIK).get(url(id))).status).toBe(404);
    expect((await as(PERSIK).patch(url(id)).send({ enabled: true })).status).toBe(404);
    expect((await makeBot(id, PERSIK)).status).toBe(404);
  });
});

describe('what the assistants know about you both', () => {
  it('can be written by anyone in the chat, and announced', async () => {
    const id = await chatWithBoth();
    const res = await as(IRJA).patch(url(id)).send({ aboutUs: 'We live in Tallinn. Our anniversary is 21 October.' });
    expect(res.body.data.aboutUs).toBe('We live in Tallinn. Our anniversary is 21 October.');
    expect(await lines(id)).toEqual(['Irja updated what the assistants know about you']);
  });

  it('is limited in length, and an empty change is refused', async () => {
    const id = await chatWithBoth();
    expect((await as(TOM).patch(url(id)).send({ aboutUs: 'x'.repeat(1501) })).status).toBe(400);
    expect((await as(TOM).patch(url(id)).send({})).status).toBe(400);
  });
});

describe('what the group admins decide', () => {
  it('lets only an owner or admin lock assistants off, whatever the switch says', async () => {
    const id = await chatWithBoth();
    await as(TOM).patch(url(id)).send({ enabled: true });

    expect((await as(TOM).patch(url(id)).send({ lockedOff: true })).status).toBe(403);

    asManager('irja@example.com');
    const res = await as(IRJA).patch(url(id)).send({ lockedOff: true });
    expect(res.body.data).toMatchObject({ lockedOff: true, enabled: false, isManager: true });
    expect(await lines(id)).toContain('Irja locked assistants off for this chat');
    // The switch cannot get round the lock.
    await as(TOM).patch(url(id)).send({ enabled: true });
    expect((await view(id)).enabled).toBe(false);

    await as(IRJA).patch(url(id)).send({ lockedOff: false });
    expect((await view(id)).enabled).toBe(true);
    expect(await lines(id)).toContain('Irja unlocked assistants in this chat');
  });

  it('lets them keep adding bots to admins only', async () => {
    const id = await chatWithBoth();
    asManager('irja@example.com');
    expect((await as(TOM).patch(url(id)).send({ whoCanAdd: 'admins' })).status).toBe(403);

    await as(IRJA).patch(url(id)).send({ whoCanAdd: 'admins' });
    expect(await lines(id)).toContain('Irja made adding assistants admins only');
    expect((await view(id)).canAdd).toBe(false);
    expect((await view(id, IRJA)).canAdd).toBe(true);
    const refused = await makeBot(id, TOM);
    expect(refused.status).toBe(403);
    expect((await makeBot(id, IRJA, { name: 'Bubu' })).status).toBe(201);

    await as(IRJA).patch(url(id)).send({ whoCanAdd: 'everyone' });
    expect(await lines(id)).toContain('Irja let everyone add an assistant');
  });


});

describe('adding a bot', () => {
  it('makes it, with the next free colour and the default model, and announces it', async () => {
    const id = await chatWithBoth();
    const res = await makeBot(id, TOM, { name: 'Tumbi', personality: 'Cheeky.', aboutOwner: 'Likes tea.' });

    expect(res.status).toBe(201);
    const bot = res.body.data.bots[0];
    expect(bot).toMatchObject({
      name: 'Tumbi',
      personality: 'Cheeky.',
      aboutOwner: 'Likes tea.',
      model: 'claude-sonnet-5-5',
      modelLabel: 'Balanced',
      paused: false,
      ownerId: 'u-tom',
      ownerName: 'Tom',
      mine: true,
      canManage: true
    });
    expect(await lines(id)).toEqual(['Tom added the assistant Tumbi']);

    const second = (await makeBot(id, IRJA, { name: 'Bubu' })).body.data.bots;
    expect(second.map((entry: { color: string }) => entry.color)).toEqual(['#7c3aed', '#0369a1']);
    // Mine to Irja, who made it, and someone else's bot to Tom.
    expect(second[1]).toMatchObject({ name: 'Bubu', mine: true, canManage: true });
    expect((await view(id)).bots[1]).toMatchObject({ name: 'Bubu', mine: false, canManage: false });
  });

  it('tells every open thread to reload what the dialog shows', async () => {
    const id = await chatWithBoth();
    const sent: string[] = [];
    subscribe('u-irja', ['g1'], { send: (chunk: string) => sent.push(chunk) > 0 } as unknown as import('@tumbaland/backend-core').SseStream);
    await makeBot(id);
    expect(sent.join('')).toContain('"assistants":true');
  });

  it('lets a person have one per chat', async () => {
    const id = await chatWithBoth();
    await makeBot(id);
    const again = await makeBot(id, TOM, { name: 'Another' });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/already have an assistant/);
    expect((await view(id)).canAdd).toBe(false);
    expect((await view(id, IRJA)).canAdd).toBe(true);
  });

  it('survives two taps on Add at once', async () => {
    const id = await chatWithBoth();
    const results = await Promise.all([makeBot(id, TOM, { name: 'One' }), makeBot(id, TOM, { name: 'Two' })]);
    expect(results.map((res) => res.status).sort()).toEqual([201, 400]);
    expect(await ChatBot.countDocuments({ conversationId: id })).toBe(1);
  });

  it('refuses names that would be confusing', async () => {
    const id = await chatWithBoth();
    await makeBot(id, TOM, { name: 'Tumbi' });
    for (const [name, message] of [
      ['Claude', /taken/],
      ['claude', /taken/],
      ['Irja', /name of someone in this chat/],
      ['tumbi', /already an assistant called/]
    ] as const) {
      const res = await makeBot(id, IRJA, { name });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(message);
    }
    for (const name of ['', '   ', 'x'.repeat(25), 'Tum!bi', 'Tum  bi', ' ']) {
      expect((await makeBot(id, IRJA, { name })).status).toBe(400);
    }
    expect((await makeBot(id, IRJA, { name: 'Mõmmi Bot 2' })).status).toBe(201);
  });

  it('keeps what it was told within the limit', async () => {
    const id = await chatWithBoth();
    expect((await makeBot(id, TOM, { name: 'Tumbi', personality: 'x'.repeat(1501) })).status).toBe(400);
    expect((await makeBot(id, TOM, { name: 'Tumbi', color: '#000000' })).status).toBe(400);
    expect((await makeBot(id, TOM, { name: 'Tumbi', model: 'gpt-5' })).status).toBe(400);
  });

  it('offers only the models an admin has turned on, and refuses the rest', async () => {
    await AssistantProviderKey.create({
      ciphertext: 'x',
      iv: 'x',
      tag: 'x',
      last4: '0000',
      setBy: 'u-admin',
      models: { enabled: ['claude-haiku-5-5'], default: 'claude-haiku-5-5' }
    });
    const id = await chatWithBoth();

    const data = await view(id);
    expect(data.models.default).toBe('claude-haiku-5-5');
    expect(data.models.options.map((option: { id: string }) => option.id)).toEqual(['claude-haiku-5-5']);

    const refused = await makeBot(id, TOM, { name: 'Tumbi', model: 'claude-opus-5-5' });
    expect(refused.status).toBe(400);
    expect(refused.body.message).toBe('That model is not available');
    expect((await makeBot(id, TOM, { name: 'Tumbi' })).body.data.bots[0].model).toBe('claude-haiku-5-5');
  });

  it('shows the default for a bot whose model has been turned off since', async () => {
    const id = await chatWithBoth();
    await makeBot(id, TOM, { name: 'Tumbi', model: 'claude-opus-5-5' });
    await AssistantProviderKey.create({
      ciphertext: 'x',
      iv: 'x',
      tag: 'x',
      last4: '0000',
      setBy: 'u-admin',
      models: { enabled: ['claude-haiku-5-5', 'claude-sonnet-5-5'], default: 'claude-sonnet-5-5' }
    });
    expect((await view(id)).bots[0]).toMatchObject({ model: 'claude-sonnet-5-5', modelLabel: 'Balanced' });
  });

  it('shows everyone what it was told, and the starting personalities', async () => {
    const id = await chatWithBoth();
    await makeBot(id, TOM, { name: 'Tumbi', personality: 'Cheeky.' });
    const data = await view(id, IRJA);
    expect(data.bots[0].personality).toBe('Cheeky.');
    expect(data.presets.map((preset: { name: string }) => preset.name)).toContain('Warm and brief');
    expect(data.presets.every((preset: { personality: string }) => !preset.personality.includes('—'))).toBe(true);
    expect(data.colors).toHaveLength(8);
  });
});

describe('changing a bot', () => {
  let id: string;
  let botId: string;

  beforeEach(async () => {
    id = await chatWithBoth();
    botId = (await makeBot(id)).body.data.bots[0].id;
  });

  const patch = (body: object, user = TOM, target = botId) => as(user).patch(url(id, `/bots/${target}`)).send(body);

  it('lets its owner rename it, change how it talks, switch its model, and pause it, each said in the thread', async () => {
    await patch({ name: 'Mochi' });
    await patch({ personality: 'Dry.' });
    await patch({ model: 'claude-opus-5-5' });
    await patch({ paused: true });
    const res = await patch({ paused: false });

    expect(res.body.data.bots[0]).toMatchObject({ name: 'Mochi', personality: 'Dry.', model: 'claude-opus-5-5', paused: false });
    expect(await lines(id)).toEqual([
      'Tom added the assistant Tumbi',
      'Tom renamed the assistant Tumbi to Mochi',
      'Tom changed how Mochi talks',
      'Tom switched Mochi to Best',
      'Tom paused Mochi',
      'Tom resumed Mochi'
    ]);
  });

  it('says nothing for a change nobody would notice', async () => {
    await patch({ name: 'tumbi' });
    await patch({ aboutOwner: 'Likes tea.', color: '#be123c' });
    await patch({ personality: '' });
    expect(await lines(id)).toEqual(['Tom added the assistant Tumbi']);
    expect((await view(id)).bots[0]).toMatchObject({ name: 'tumbi', aboutOwner: 'Likes tea.', color: '#be123c' });
  });

  it('refuses a name someone else has, and nothing to change', async () => {
    await makeBot(id, IRJA, { name: 'Bubu' });
    expect((await patch({ name: 'bubu' })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ model: 'gpt-5' })).status).toBe(400);
  });

  it('does not let another member change it', async () => {
    const res = await patch({ paused: true }, IRJA);
    expect(res.status).toBe(403);
    expect((await as(IRJA).delete(url(id, `/bots/${botId}`))).status).toBe(403);
    expect((await view(id)).bots[0].paused).toBe(false);
  });

  it('lets a group admin change it, tells the owner, and does not make it theirs', async () => {
    asManager('irja@example.com');
    const res = await patch({ paused: true, personality: 'Quiet.' }, IRJA);

    expect(res.status).toBe(200);
    expect(res.body.data.bots[0]).toMatchObject({ paused: true, ownerId: 'u-tom', ownerName: 'Tom', mine: false, canManage: true });
    expect(await lines(id)).toContain('Irja paused Tumbi');
    expect(sendToUsers).toHaveBeenCalledWith(['u-tom'], expect.objectContaining({ title: 'Your assistant was changed', body: 'Irja paused Tumbi' }));
    expect((await ChatBot.findById(botId))!.updatedById).toBe('u-irja');
  });

  it('does not notify the owner of their own change', async () => {
    await patch({ paused: true });
    expect(sendToUsers).not.toHaveBeenCalled();
  });

  it('can be removed by its owner or an admin, and what it said stays', async () => {
    await Message.create({ conversationId: id, senderId: `bot:${botId}`, senderEmail: 'assistant@tumbaland.eu', senderName: 'Tumbi', botId, body: 'Hi', clientId: 'x1' });
    const res = await as(TOM).delete(url(id, `/bots/${botId}`));

    expect(res.body.data.bots).toEqual([]);
    expect(await lines(id)).toContain('Tom removed Tumbi');
    expect(await Message.countDocuments({ botId })).toBe(1);
    expect((await view(id)).canAdd).toBe(true);

    const again = (await makeBot(id, IRJA, { name: 'Bubu' })).body.data.bots[0].id;
    asManager('tom@example.com');
    await as(TOM).delete(url(id, `/bots/${again}`));
    expect(sendToUsers).toHaveBeenCalledWith(['u-irja'], expect.objectContaining({ body: 'Tom removed Bubu' }));
  });

  it('is not found when the id is not a bot of this chat', async () => {
    const other = await conversationInG1().then(async () => {
      const { Types } = await import('mongoose');
      return new Types.ObjectId().toString();
    });
    expect((await patch({ paused: true }, TOM, other)).status).toBe(404);
    expect((await patch({ paused: true }, TOM, 'not-an-id')).status).toBe(404);
    expect((await as(TOM).delete(url(id, `/bots/${other}`))).status).toBe(404);
  });
});

describe('your allowance', () => {
  it('is in the dialog, and on its own for the Account page', async () => {
    const id = await chatWithBoth();
    await recordUsage('tom@example.com', 'assistantSpend', 2000);

    expect((await view(id)).allowance).toMatchObject({ limit: 5000, used: 2000, percent: 40, capPercent: null, exhausted: false });
    expect((await as(TOM).get('/api/chat/assistants/me')).body.data).toMatchObject({ used: 2000, percent: 40 });
    expect((await as(IRJA).get('/api/chat/assistants/me')).body.data).toMatchObject({ used: 0, percent: 0 });
  });

  it('can be capped lower by the person, and only lower', async () => {
    await recordUsage('tom@example.com', 'assistantSpend', 2600);
    const res = await as(TOM).put('/api/chat/assistants/me').send({ capPercent: 50 });
    expect(res.body.data).toMatchObject({ capPercent: 50, percent: 52, exhausted: true });

    expect((await as(TOM).put('/api/chat/assistants/me').send({ capPercent: null })).body.data).toMatchObject({ capPercent: null, exhausted: false });
    expect((await as(TOM).put('/api/chat/assistants/me').send({ capPercent: 150 })).status).toBe(400);
    expect((await as(TOM).put('/api/chat/assistants/me').send({ capPercent: 5 })).status).toBe(400);
  });

  it('runs out at the limit, and starts again on the first of next month', async () => {
    await recordUsage('tom@example.com', 'assistantSpend', 5000);
    const data = (await as(TOM).get('/api/chat/assistants/me')).body.data;
    expect(data).toMatchObject({ exhausted: true, percent: 100 });
    expect(data.resetsOn).toMatch(/^\d{4}-\d{2}-01$/);
    expect(new Date(`${data.resetsOn}T00:00:00Z`).getTime()).toBeGreaterThan(Date.now());
  });

  it('falls back to the plan\u2019s default, not to no limit, when payment-service does not list the meter yet', async () => {
    (getEntitlements as jest.Mock).mockImplementation(async (email: string) => {
      const limits = normalizeLimits({}, 'free');
      delete (limits.meters as Partial<typeof limits.meters>).assistantSpend;
      return { email, planCode: 'free', status: null, limits };
    });
    const data = (await as(TOM).get('/api/chat/assistants/me')).body.data;
    expect(data.limit).toBe(5000);
  });

  it('has no ceiling on a plan without one', async () => {
    (getEntitlements as jest.Mock).mockImplementation(async (email: string) => ({
      email,
      planCode: 'staff',
      status: 'active',
      limits: normalizeLimits({}, 'staff')
    }));
    await recordUsage('tom@example.com', 'assistantSpend', 999_999);
    expect((await as(TOM).get('/api/chat/assistants/me')).body.data).toMatchObject({ limit: null, percent: null, exhausted: false });
  });
});
