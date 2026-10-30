process.env.SERVICE_NAME = 'chat-service';
process.env.JWT_SECRET = 'test-secret';
process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';
process.env.API_KEY_ENCRYPTION_SECRET = 'a-secret-long-enough-to-seal-keys-with';
process.env.MCP_PUBLIC_URL = 'https://mcp.test';

/**
 * Mentioning an assistant: who it acts for, what stops it, what it posts and
 * what it costs. Through the real middleware, controllers and database. Claude,
 * group roles, push and the plan are replaced; the Tumbaland key it is handed is
 * the real thing, so what that key can reach is checked, not assumed.
 */
jest.mock('./services/assistantClaude', () => ({ askClaude: jest.fn() }));
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

import {
  ApiKey,
  encryptSecret,
  getEntitlements,
  getGroupOwner,
  getUsage,
  normalizeLimits,
  recordUsage,
  resetEncryptionKeyCache,
  verifyApiKey
} from '@tumbaland/backend-core';
import { as, TOM, IRJA, clientId, conversationInG1, setupChatIntegration } from './test/integration';
import { askClaude, type ClaudeRequest, type ClaudeReply } from './services/assistantClaude';
import { resetKeyCache } from './services/assistantKeyService';
import { sendToUsers } from './services/pushService';
import { subscribe } from './services/streamHub';
import { JOIN_IN, activityFor, collageFrom, triggerAssistants } from './services/assistantReplyService';
import { AssistantProviderKey } from './models/AssistantProviderKey';
import { AssistantPreference } from './models/AssistantPreference';
import { AssistantUsage } from './models/AssistantUsage';
import { ChatBot } from './models/ChatBot';
import { Conversation } from './models/Conversation';
import { Message } from './models/Message';
import * as messageService from './services/messageService';

setupChatIntegration();

const ask = askClaude as jest.MockedFunction<typeof askClaude>;
const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789WXYZ';
const usage = { input: 20_000, output: 300, cacheRead: 0, cacheWrite: 0 };
const answer = (overrides: Partial<ClaudeReply> = {}): ClaudeReply => ({
  text: 'Try the old town.',
  refused: false,
  toolCalls: [],
  sources: [],
  usage,
  servedBy: 'claude-sonnet-5-5',
  ...overrides
});
const COLLAGE_ID = '64b8f0c2e1b2c3d4e5f60718';

const url = (id: string, rest = '') => `/api/chat/conversations/${id}${rest}`;
const send = (id: string, body: string, user = TOM, cid = clientId()) =>
  as(user).post(url(id, '/messages')).send({ clientId: cid, body });
const makeBot = (id: string, user: typeof TOM, name: string, extra: object = {}) =>
  as(user).post(url(id, '/assistants/bots')).send({ name, ...extra });
const botMessages = (id: string) => Message.find({ conversationId: id, botId: { $ne: null } }).sort({ createdAt: 1 });
const systemLines = async (id: string) => (await Message.find({ conversationId: id, kind: 'system' }).sort({ createdAt: 1 })).map((m) => m.body);

/** The reply is sent after the response, so a test waits for what it is about to check. */
async function eventually<T>(read: () => Promise<T>, done: (value: T) => boolean = Boolean as never, ms = 4000): Promise<T> {
  const until = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (done(value) || Date.now() > until) return value;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
}
const nextUsage = () => eventually(() => AssistantUsage.find().sort({ createdAt: 1 }), (rows) => rows.length > 0);

const seedKey = async (overrides: object = {}) => {
  await AssistantProviderKey.create({ ...encryptSecret(KEY), last4: 'WXYZ', setBy: 'u-admin', ...overrides });
  resetKeyCache();
};

/** Both people on the chat, assistants on, Tom with a bot called Tumbi, and a key saved. */
async function readyChat(): Promise<string> {
  const id = await conversationInG1();
  await as(IRJA).get(url(id));
  await as(TOM).patch(url(id, '/assistants')).send({ enabled: true });
  await makeBot(id, TOM, 'Tumbi', { personality: 'Cheeky.', aboutOwner: 'Likes tea.' });
  await as(TOM).patch(url(id, '/assistants')).send({ aboutUs: 'We live in Tallinn.' });
  await seedKey();
  return id;
}

beforeEach(() => {
  ask.mockReset().mockImplementation(async (request: ClaudeRequest) => answer({ servedBy: request.model }));
  (getGroupOwner as jest.Mock).mockResolvedValue({ groupId: 'g1', ownerEmail: 'tom@example.com', memberCount: 2, deleted: false });
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

describe('an assistant answers when it is mentioned', () => {
  it('posts its reply as itself, labelled, in the thread everyone reads', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi where should we eat Saturday?');

    const [reply] = await eventually(() => botMessages(id), (rows) => rows.length > 0);

    expect(reply).toMatchObject({ kind: 'text', body: 'Try the old town.', senderName: 'Tumbi', senderEmail: 'assistant@tumbaland.eu' });
    expect(reply!.senderId).toMatch(/^bot:/);
    expect(reply!.botId).toBe((await ChatBot.findOne())!._id.toString());
    const page = (await as(IRJA).get(url(id, '/messages'))).body.data.messages;
    expect(page[0]).toMatchObject({ body: 'Try the old town.', botId: reply!.botId });
    const list = (await as(IRJA).get('/api/chat/conversations')).body.data[0];
    expect(list.lastMessagePreview).toBe('Try the old town.');
    expect(list.unreadCount).toBeGreaterThan(0);
  });

  it('tells Claude who it is, what it was told, what was said and what was asked', async () => {
    const id = await readyChat();
    await send(id, 'we are back from the sea', IRJA);
    await send(id, '@Tumbi where should we eat Saturday?');
    await nextUsage();

    const request = ask.mock.calls[0]![0];
    expect(request.apiKey).toBe(KEY);
    expect(request.model).toBe('claude-sonnet-5-5');
    expect(request.mcpUrl).toBe('https://mcp.test/mcp');
    expect(request.system).toHaveLength(2);
    expect(request.system[0]).toMatch(/You are an AI/);
    expect(request.system[1]).toContain('Your name is Tumbi. Tom made you.');
    expect(request.system[1]).toContain('Cheeky.');
    expect(request.system[1]).toContain('Likes tea.');
    expect(request.system[1]).toContain('We live in Tallinn.');
    expect(request.user).toContain('Irja: we are back from the sea');
    expect(request.user).toContain('Tom just wrote to you, Tumbi: @Tumbi where should we eat Saturday?');
    expect(request.user).not.toContain('turned assistants on');
  });

  it('leaves its owner\u2019s private details out when someone else asks', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi where should we eat Saturday?', IRJA);
    await nextUsage();

    const request = ask.mock.calls[0]![0];
    expect(request.system[1]).toContain('Cheeky.');
    expect(request.system[1]).not.toContain('Likes tea.');
  });

  it('posts plain chat text, not Markdown, with the pages it drew on underneath', async () => {
    const id = await readyChat();
    ask.mockResolvedValue(answer({ text: '**Kolm Sõpra** is open late:\n- mains ~25 EUR', sources: [{ url: 'https://kolm.ee', title: 'Kolm Sõpra' }] }));
    await send(id, '@Tumbi dinner?');
    const [reply] = await eventually(() => botMessages(id), (rows) => rows.length === 1);
    expect(reply!.body).toBe('Kolm Sõpra is open late:\n• mains ~25 EUR\n\nSources:\n• Kolm Sõpra: https://kolm.ee');
  });

  it('hands over the web, and tells the bot about it, unless the web is switched off', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi hello');
    await nextUsage();
    expect(ask.mock.calls[0]![0].web).toMatchObject({ city: 'Tallinn', timeZone: 'Europe/Tallinn' });
    expect(ask.mock.calls[0]![0].system[0]).toContain('search the web');

    process.env.ASSISTANT_WEB = 'off';
    try {
      await send(id, '@Tumbi hello again');
      await eventually(() => AssistantUsage.countDocuments(), (count) => count === 2);
      expect(ask.mock.calls[1]![0].web).toBeUndefined();
      expect(ask.mock.calls[1]![0].system[0]).not.toContain('search the web');
    } finally {
      delete process.env.ASSISTANT_WEB;
    }
  });

  it('hands over the notes and the tools to keep them, and the place search', async () => {
    const id = await readyChat();
    await as(IRJA).patch(url(id, '/assistants')).send({ memory: 'Irja is vegetarian' });
    await send(id, '@Tumbi hello');
    await nextUsage();
    const request = ask.mock.calls[0]![0];
    expect(request.system[1]).toContain('Irja is vegetarian');
    expect(request.system[1]).toContain('remember and forget tools');
    expect(request.clientTools!.map((tool) => tool.name)).toEqual(['remember', 'forget', 'find_places', 'get_weather', 'search_chat', 'where_is', 'saved_places', 'get_route', 'convert_currency']);
  });

  it('leaves out the note tools, and the rules about them, when people turned noting off', async () => {
    const id = await readyChat();
    await as(IRJA).patch(url(id, '/assistants')).send({ memory: 'Irja is vegetarian', memoryOn: false });
    await send(id, '@Tumbi hello');
    await nextUsage();
    const request = ask.mock.calls[0]![0];
    expect(request.system[1]).toContain('Irja is vegetarian');
    expect(request.system[1]).not.toContain('remember and forget');
    expect(request.clientTools!.map((tool) => tool.name)).toEqual(['find_places', 'get_weather', 'search_chat', 'where_is', 'saved_places', 'get_route', 'convert_currency']);
  });

  it('saves a note the bot asks to keep where people can see it, without undoing an edit made meanwhile', async () => {
    const id = await readyChat();
    ask.mockImplementation(async (request: ClaudeRequest) => {
      // Someone edits the notes while the bot is working; the bot's note lands on top of theirs.
      await as(IRJA).patch(url(id, '/assistants')).send({ memory: 'Irja is vegetarian' });
      const said = await request.clientTools!.find((tool) => tool.name === 'remember')!.run({ note: 'Tom likes tea' });
      return answer({ text: said, servedBy: request.model });
    });
    await send(id, '@Tumbi remember Tom likes tea');
    await nextUsage();
    expect((await Conversation.findById(id))!.assistants!.memory).toBe('Irja is vegetarian\nTom likes tea');
    expect((await as(TOM).get(url(id, '/assistants'))).body.data.memory).toBe('Irja is vegetarian\nTom likes tea');
  });

  it('is not held up by Claude: the send is answered first', async () => {
    const id = await readyChat();
    let release: () => void = () => undefined;
    ask.mockImplementation(() => new Promise((resolve) => (release = () => resolve(answer()))));

    const res = await send(id, '@Tumbi hello');
    expect(res.status).toBe(201);
    // Claude has been asked, and has not answered, and the send has already come back.
    await eventually(async () => ask.mock.calls.length, (calls) => calls > 0);
    expect(await botMessages(id)).toHaveLength(0);

    release();
    expect(await eventually(() => botMessages(id), (rows) => rows.length === 1)).toHaveLength(1);
  });

  it('wakes only on a mention of a bot in this chat', async () => {
    const id = await readyChat();
    await send(id, 'Tumbi is lovely');
    await send(id, '@Nobody are you there');
    await send(id, '@Tumbiii hello');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(ask).not.toHaveBeenCalled();
  });

  it('does not wake twice for a message sent twice', async () => {
    const id = await readyChat();
    const same = clientId();
    await send(id, '@Tumbi hello', TOM, same);
    await send(id, '@Tumbi hello', TOM, same);
    await nextUsage();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('is never woken by an assistant or by a system line', async () => {
    const id = await readyChat();
    const conversation = (await Conversation.findById(id))!;
    const base = { id: 'm', conversationId: id, senderId: 'u-tom', senderName: 'Tom', senderEmail: 't', clientId: 'c', attachments: [], reactions: [] };
    triggerAssistants({ id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] }, conversation, { ...base, kind: 'text', body: '@Tumbi', botId: 'b1' } as never);
    triggerAssistants({ id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] }, conversation, { ...base, kind: 'system', body: '@Tumbi', botId: null } as never);
    triggerAssistants({ id: 'u-tom', email: 'tom@example.com', name: 'Tom', groups: ['g1'] }, conversation, { ...base, kind: 'media', body: '@Tumbi', botId: null } as never);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ask).not.toHaveBeenCalled();
  });

  it('answers several mentioned assistants in the order they were asked, each reading the one before', async () => {
    const id = await readyChat();
    await makeBot(id, IRJA, 'Bubu');
    ask.mockImplementation(async (request) =>
      answer({ text: request.system[1]!.includes('Tumbi') ? 'Pizza.' : 'Sushi, obviously.', servedBy: request.model })
    );

    await send(id, '@Bubu @Tumbi pizza or sushi?');
    await eventually(() => botMessages(id), (rows) => rows.length === 2);

    expect((await botMessages(id)).map((message) => `${message.senderName}: ${message.body}`)).toEqual(['Bubu: Sushi, obviously.', 'Tumbi: Pizza.']);
    expect(ask.mock.calls[0]![0].system[1]).toContain('Your name is Bubu');
    expect(ask.mock.calls[1]![0].user).toContain('Bubu (assistant): Sushi, obviously.');
  });

  it('takes @Claude to mean your own assistant, and to mean nothing if you have none', async () => {
    const id = await readyChat();
    await send(id, '@Claude what is on this weekend?');
    await nextUsage();
    expect(ask.mock.calls[0]![0].system[1]).toContain('Your name is Tumbi');

    ask.mockClear();
    await send(id, '@Claude and what about me?', IRJA);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ask).not.toHaveBeenCalled();
  });

  it('does not answer twice when a message names the bot and @Claude', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi @Claude hello');
    await eventually(() => botMessages(id), (rows) => rows.length >= 1);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('shows who is working and on what while it works', async () => {
    const id = await readyChat();
    const sent: string[] = [];
    subscribe('u-irja', ['g1'], { send: (chunk: string) => sent.push(chunk) > 0 } as unknown as import('@tumbaland/backend-core').SseStream);
    ask.mockImplementation(async (request) => {
      request.onTool?.('create_collage');
      return answer({ servedBy: request.model });
    });

    await send(id, '@Tumbi make a collage');
    await nextUsage();

    const typing = sent.join('');
    expect(typing).toContain('"type":"typing"');
    expect(typing).toContain('"bot":true');
    expect(typing).toContain('"name":"Tumbi"');
    expect(typing).toContain('"activity":"making a collage"');
  });
});

describe('replying to an assistant', () => {
  const quoteOf = async (id: string) => {
    const [reply] = await eventually(() => botMessages(id), (rows) => rows.length > 0);
    return reply!._id.toString();
  };
  const replyTo = (id: string, messageId: string, body: string, user = TOM) =>
    as(user).post(url(id, '/messages')).send({ clientId: clientId(), body, replyTo: messageId });

  it('asks it again, without naming it', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi where should we eat?');
    const answered = await quoteOf(id);
    await nextUsage();

    await replyTo(id, answered, 'and somewhere cheaper?', IRJA);
    await eventually(() => AssistantUsage.countDocuments(), (count) => count === 2);

    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1]![0].user).toContain('Irja just wrote to you, Tumbi: and somewhere cheaper?');
  });

  it('asks whoever the reply names instead, when it names someone else', async () => {
    const id = await readyChat();
    await makeBot(id, IRJA, 'Bubu');
    await send(id, '@Tumbi pizza?');
    const answered = await quoteOf(id);
    await nextUsage();

    await replyTo(id, answered, '@Bubu what do you think of that?', IRJA);
    await eventually(() => AssistantUsage.countDocuments(), (count) => count === 2);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1]![0].system[1]).toContain('Your name is Bubu');
  });

  it('does nothing for a reply to a person', async () => {
    const id = await readyChat();
    const mine = (await send(id, 'hello', IRJA)).body.data.id as string;
    await replyTo(id, mine, 'hi back');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(ask).not.toHaveBeenCalled();
  });

  it('does nothing for a reply to an assistant that has since been removed', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi hello');
    const answered = await quoteOf(id);
    await nextUsage();
    await ChatBot.deleteMany({});
    await replyTo(id, answered, 'thanks');
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(ask).toHaveBeenCalledTimes(1);
  });
});

describe('who it acts for', () => {
  it('uses a key for the person who asked, five minutes long, for this group, with journal and photos only', async () => {
    const id = await readyChat();
    let verified: Awaited<ReturnType<typeof verifyApiKey>> | undefined;
    let expiresAt = new Date(0);
    ask.mockImplementation(async (request) => {
      verified = await verifyApiKey(request.mcpToken);
      expiresAt = (await ApiKey.findOne())!.expiresAt!;
      return answer({ servedBy: request.model });
    });

    await send(id, '@Tumbi what did we do last week?');
    await nextUsage();

    expect(verified).toMatchObject({ ok: true, userId: 'u-tom', userEmail: 'tom@example.com' });
    const key = verified as unknown as { scopes: string[]; tenants: { allowed: string[]; default: string } };
    expect([...key.scopes].sort()).toEqual(['album:read', 'album:write', 'relationship:read', 'relationship:write']);
    expect(key.scopes.some((scope) => scope.startsWith('finance'))).toBe(false);
    expect(key.tenants).toMatchObject({ allowed: ['g1'], default: 'g1' });
    const lifetime = expiresAt.getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(4 * 60_000);
    expect(lifetime).toBeLessThanOrEqual(5 * 60_000);
  });

  it('acts as whoever mentioned it, not as the bot owner, and charges them', async () => {
    const id = await readyChat();
    let userId = '';
    ask.mockImplementation(async (request) => {
      userId = ((await verifyApiKey(request.mcpToken)) as { userId: string }).userId;
      return answer({ servedBy: request.model });
    });

    // Irja asks Tom's assistant.
    await send(id, '@Tumbi plan Friday', IRJA);
    const [row] = await nextUsage();

    expect(userId).toBe('u-irja');
    expect(row).toMatchObject({ mentionerId: 'u-irja', mentionerEmail: 'irja@example.com', botName: 'Tumbi' });
    expect(await getUsage('irja@example.com', 'assistantSpend')).toBe(row!.units);
    expect(await getUsage('tom@example.com', 'assistantSpend')).toBe(0);
    expect(ask.mock.calls[0]![0].user).toContain('Irja just wrote to you, Tumbi');
  });

  it('takes the key back when it is done, and when it fails', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi hello');
    await nextUsage();
    expect(await ApiKey.countDocuments()).toBe(0);

    ask.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    await send(id, '@Tumbi hello again');
    await eventually(() => AssistantUsage.countDocuments(), (count) => count === 2);
    expect(await ApiKey.countDocuments()).toBe(0);
  });
});

describe('what it costs', () => {
  it('records the tokens and charges the allowance by them', async () => {
    const id = await readyChat();
    await send(id, '@Tumbi hello');
    const [row] = await nextUsage();

    // 20,000 in and 300 out on Sonnet: $0.04 + $0.003.
    expect(row).toMatchObject({
      conversationId: id,
      groupId: 'g1',
      modelId: 'claude-sonnet-5-5',
      inputTokens: 20_000,
      outputTokens: 300,
      units: 430,
      outcome: 'ok'
    });
    expect(row!.durationMs).toBeGreaterThanOrEqual(0);
    expect(await getUsage('tom@example.com', 'assistantSpend')).toBe(430);
  });

  it('prices it by the model that really answered, when a fallback ran', async () => {
    const id = await readyChat();
    ask.mockResolvedValue(answer({ servedBy: 'claude-opus-5-5' }));
    await send(id, '@Tumbi hello');
    const [row] = await nextUsage();
    expect(row).toMatchObject({ modelId: 'claude-opus-5-5', units: 860 });
  });

  it('uses the bot’s own model, and the default when admin has turned that one off', async () => {
    const id = await readyChat();
    await as(TOM).patch(url(id, '/assistants/bots/' + (await ChatBot.findOne())!._id)).send({ model: 'claude-opus-5-5' });
    await send(id, '@Tumbi hello');
    await nextUsage();
    expect(ask.mock.calls[0]![0].model).toBe('claude-opus-5-5');

    ask.mockClear();
    await AssistantProviderKey.updateOne({}, { $set: { models: { enabled: ['claude-haiku-5-5'], default: 'claude-haiku-5-5' } } });
    resetKeyCache();
    await send(id, '@Tumbi hello again');
    await eventually(() => AssistantUsage.countDocuments(), (count) => count === 2);
    expect(ask.mock.calls[0]![0].model).toBe('claude-haiku-5-5');
  });

  it('says once, quietly, when a reply takes someone past 80% of the allowance', async () => {
    const id = await readyChat();
    // 3700 of 5000 is 74%; this reply costs 430 more, which is 83%.
    await recordUsage('tom@example.com', 'assistantSpend', 3700);

    await send(id, '@Tumbi hello');
    await nextUsage();
    const lines = await eventually(() => systemLines(id), (all) => all.some((line) => line.includes('% of this month')));
    expect(lines.at(-1)).toBe("Tom has used 83% of this month's assistant allowance.");

    await send(id, '@Tumbi and again');
    await eventually(() => AssistantUsage.countDocuments(), (count) => count === 2);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect((await systemLines(id)).filter((line) => line.includes('% of this month'))).toHaveLength(1);
  });
});

describe('what stops it, said in the thread', () => {
  const never = async (id: string, line: string | RegExp, user = TOM, text = '@Tumbi hello') => {
    await send(id, text, user);
    const lines = await eventually(() => systemLines(id), (all) => all.some((entry) => (typeof line === 'string' ? entry === line : line.test(entry))));
    expect(lines.some((entry) => (typeof line === 'string' ? entry === line : line.test(entry)))).toBe(true);
    expect(ask).not.toHaveBeenCalled();
    expect(await AssistantUsage.countDocuments()).toBe(0);
    expect(await botMessages(id)).toHaveLength(0);
  };

  it('assistants someone in the chat has turned off', async () => {
    const id = await readyChat();
    await as(IRJA).patch(url(id, '/assistants')).send({ enabled: false });
    await never(id, 'Assistants are off in this chat. Anyone here can turn them on, under Assistants in the chat menu.');
  });

  it('assistants an admin has locked off', async () => {
    const id = await readyChat();
    await Conversation.updateOne({ _id: id }, { $set: { 'assistants.lockedOff': true } });
    await never(id, 'Assistants are off in this chat. Anyone here can turn them on, under Assistants in the chat menu.');
  });



  it('a paused assistant', async () => {
    const id = await readyChat();
    await ChatBot.updateOne({}, { $set: { paused: true } });
    await never(id, 'Tumbi is paused.');
  });

  it('no key, a removed key, or one Anthropic rejected', async () => {
    const id = await readyChat();
    await AssistantProviderKey.deleteMany({});
    resetKeyCache();
    await never(id, "Tumbi isn't available right now.");
  });

  it('a key already marked rejected', async () => {
    const id = await readyChat();
    await AssistantProviderKey.updateOne({}, { $set: { status: 'rejected' } });
    resetKeyCache();
    await never(id, "Tumbi isn't available right now.");
  });

  it('an allowance that is used up, naming the day it starts again', async () => {
    const id = await readyChat();
    await recordUsage('tom@example.com', 'assistantSpend', 5000);
    // Everyone reads it, so it says whose allowance it is.
    await never(id, /^Tom has used this month's assistant allowance\. It starts again on 1 \w+\.$/);
  });

  it("a person's own lower cap", async () => {
    const id = await readyChat();
    await AssistantPreference.create({ userId: 'u-tom', capPercent: 50 });
    await recordUsage('tom@example.com', 'assistantSpend', 2500);
    await never(id, /used this month's assistant allowance/);
  });

  it('too many questions in a minute, and in a day', async () => {
    const id = await readyChat();
    const row = { conversationId: id, groupId: 'g1', botId: 'b', mentionerId: 'u-tom', mentionerEmail: 'tom@example.com', modelId: 'claude-sonnet-5-5', outcome: 'ok' as const };
    await AssistantUsage.insertMany(Array.from({ length: 6 }, () => row));
    await send(id, '@Tumbi hello');
    await eventually(() => systemLines(id), (lines) => lines.some((line) => /a lot of questions at once/.test(line)));
    expect(ask).not.toHaveBeenCalled();

    await AssistantUsage.deleteMany({});
    const earlier = new Date(Date.now() - 3 * 60 * 60_000);
    await AssistantUsage.insertMany(Array.from({ length: 150 }, () => ({ ...row, createdAt: earlier })));
    await send(id, '@Tumbi hello');
    await eventually(() => systemLines(id), (lines) => lines.some((line) => /a lot of questions for one day/.test(line)));
    expect(ask).not.toHaveBeenCalled();
  });

  it('only counts the person who is asking', async () => {
    const id = await readyChat();
    await recordUsage('tom@example.com', 'assistantSpend', 5000);
    await send(id, '@Tumbi hello', IRJA);
    await nextUsage();
    expect(ask).toHaveBeenCalledTimes(1);
  });
});

describe('when it goes wrong', () => {
  const fails = (status?: number) => ask.mockRejectedValue(Object.assign(new Error('nope'), { status }));

  it('stops using a key Anthropic refuses, and tells the admin and the chat', async () => {
    const id = await readyChat();
    fails(401);
    await send(id, '@Tumbi hello');
    const [row] = await nextUsage();

    expect(row).toMatchObject({ outcome: 'key_rejected', units: 0 });
    expect(await systemLines(id)).toContain("Tumbi isn't available right now.");
    expect((await AssistantProviderKey.findOne())!.status).toBe('rejected');
    expect(sendToUsers).toHaveBeenCalledWith(['u-admin'], expect.objectContaining({ title: 'Claude key rejected' }));
    expect(await getUsage('tom@example.com', 'assistantSpend')).toBe(0);
  });

  it('keeps the key on a 403, which can be a model this account may not use, and says it is unavailable', async () => {
    const id = await readyChat();
    fails(403);
    await send(id, '@Tumbi hello');
    const [row] = await nextUsage();

    expect(row!.outcome).toBe('error');
    expect(await systemLines(id)).toContain("Tumbi isn't available right now.");
    expect((await AssistantProviderKey.findOne())!.status).toBe('ok');
    expect(sendToUsers).not.toHaveBeenCalledWith(['u-admin'], expect.anything());
  });

  it('still records the attempt when the line about it cannot be posted', async () => {
    const id = await readyChat();
    fails(500);
    const line = jest.spyOn(messageService, 'postSystemLine').mockRejectedValue(new Error('database hiccup'));
    try {
      await send(id, '@Tumbi hello');
      expect((await nextUsage())[0]!.outcome).toBe('error');
    } finally {
      line.mockRestore();
    }
  });

  it('asks to be tried again when Anthropic is busy', async () => {
    const id = await readyChat();
    fails(429);
    await send(id, '@Tumbi hello');
    const [row] = await nextUsage();
    expect(row!.outcome).toBe('error');
    expect(await systemLines(id)).toContain('Tumbi is busy. Try again in a minute.');
  });

  it('says it could not answer for anything else, and costs nothing', async () => {
    const id = await readyChat();
    fails(undefined);
    await send(id, '@Tumbi hello');
    const [row] = await nextUsage();
    expect(row).toMatchObject({ outcome: 'error', units: 0 });
    expect(await systemLines(id)).toContain('Tumbi could not answer that. Try again in a moment.');
  });

  it('answers politely when Anthropic declines, and still charges for what was used', async () => {
    const id = await readyChat();
    ask.mockResolvedValue(answer({ refused: true, text: '' }));
    await send(id, '@Tumbi hello');
    const [row] = await nextUsage();
    expect(row!.outcome).toBe('refused');
    expect(row!.units).toBeGreaterThan(0);
    expect((await botMessages(id))[0]!.body).toBe("I can't help with that one.");
  });
});

describe('what it makes', () => {
  const collage = {
    id: 't1',
    name: 'create_collage',
    input: {},
    isError: false,
    result: `Made "Rome, our week" (id ${COLLAGE_ID}), empty, drawing on Rome.`
  };

  it('posts the collage as a card, after what it said, like one made from the chat', async () => {
    const id = await readyChat();
    ask.mockResolvedValue(answer({ text: 'Made it. Have a look.', toolCalls: [collage] }));
    await send(id, '@Tumbi make a collage');
    const messages = await eventually(() => botMessages(id), (rows) => rows.length === 2);

    expect(messages.map((message) => message.kind)).toEqual(['text', 'collage']);
    expect(messages[0]!.body).toBe('Made it. Have a look.');
    expect(messages[1]).toMatchObject({ senderName: 'Tumbi', collage: { id: COLLAGE_ID, title: 'Rome, our week' } });
    expect((await as(IRJA).get('/api/chat/conversations')).body.data[0].lastMessagePreview).toBe('Collage: Rome, our week');
  });

  it('says it is done when it did something and had no words', async () => {
    const id = await readyChat();
    ask.mockResolvedValue(answer({ text: '', toolCalls: [{ ...collage, name: 'log_day', result: 'Logged.' }] }));
    await send(id, '@Tumbi log tonight');
    expect((await eventually(() => botMessages(id), (rows) => rows.length === 1))[0]!.body).toBe('Done.');
  });

  it('never posts an empty message', async () => {
    const id = await readyChat();
    ask.mockResolvedValue(answer({ text: '' }));
    await send(id, '@Tumbi hello');
    expect((await eventually(() => botMessages(id), (rows) => rows.length === 1))[0]!.body).toBe('...');
  });

  it('cuts a reply to what a message can hold', async () => {
    const id = await readyChat();
    ask.mockResolvedValue(answer({ text: 'y'.repeat(9000) }));
    await send(id, '@Tumbi hello');
    expect((await eventually(() => botMessages(id), (rows) => rows.length === 1))[0]!.body).toHaveLength(4000);
  });
});

describe('reading what a tool made', () => {
  it('finds the collage in create_collage’s answer, with a title that has quotes in it', () => {
    expect(collageFrom([{ id: '1', name: 'create_collage', input: {}, isError: false, result: `Made "The "big" one" (id ${COLLAGE_ID}), empty` }])).toEqual({
      id: COLLAGE_ID,
      title: 'The "big" one'
    });
  });

  it('ignores a failed call, another tool, and an answer it does not understand', () => {
    expect(collageFrom([{ id: '1', name: 'create_collage', input: {}, isError: true, result: `Made "x" (id ${COLLAGE_ID})` }])).toBeNull();
    expect(collageFrom([{ id: '1', name: 'update_collage', input: {}, isError: false, result: `Made "x" (id ${COLLAGE_ID})` }])).toBeNull();
    expect(collageFrom([{ id: '1', name: 'create_collage', input: {}, isError: false, result: 'Something else entirely' }])).toBeNull();
    expect(collageFrom([])).toBeNull();
  });

  it('says what a tool is doing in words, and falls back to a plain one', () => {
    expect(activityFor('create_collage')).toBe('making a collage');
    expect(activityFor('view_photos')).toBe('looking at photos');
    expect(activityFor('log_day')).toBe('writing in the journal');
    expect(activityFor('something_new')).toBe('working on it');
  });
});

describe('an assistant that joins in unasked', () => {
  const defaults = { ...JOIN_IN };
  let dice: jest.SpyInstance;

  beforeEach(() => {
    // A short pause to wait out, and dice that always say yes unless a test says otherwise.
    JOIN_IN.quietMs = 40;
    dice = jest.spyOn(Math, 'random').mockReturnValue(0);
  });
  afterEach(() => {
    Object.assign(JOIN_IN, defaults);
    dice.mockRestore();
  });

  const letItJoinIn = async (id: string) => {
    const botId = (await ChatBot.findOne())!._id.toString();
    return as(TOM).patch(url(id, `/assistants/bots/${botId}`)).send({ joinsIn: true });
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

  it('stays out of it unless its owner lets it, and the thread says when they do', async () => {
    const id = await readyChat();
    await send(id, 'when does Rimi close?', IRJA);
    await settle();
    expect(ask).not.toHaveBeenCalled();

    expect((await letItJoinIn(id)).body.data.bots[0].joinsIn).toBe(true);
    expect(await systemLines(id)).toContain('Tom let Tumbi join in now and then without being asked');

    const botId = (await ChatBot.findOne())!._id.toString();
    await as(TOM).patch(url(id, `/assistants/bots/${botId}`)).send({ joinsIn: false });
    expect(await systemLines(id)).toContain('Tom stopped Tumbi joining in unasked');
  });

  it('answers a question people ask each other, on its owner\u2019s allowance, only talking', async () => {
    const id = await readyChat();
    await letItJoinIn(id);
    let scopes: string[] = [];
    ask.mockImplementation(async (request) => {
      scopes = ((await verifyApiKey(request.mcpToken)) as unknown as { scopes: string[] }).scopes;
      return answer({ text: 'Rimi on Tartu mnt is open until 22:00.', servedBy: request.model });
    });

    await send(id, 'when does Rimi close?', IRJA);
    const [reply] = await eventually(() => botMessages(id), (rows) => rows.length > 0);

    expect(reply!.body).toBe('Rimi on Tartu mnt is open until 22:00.');
    const request = ask.mock.calls[0]![0];
    expect(request.user).toContain('Nobody asked you, Tumbi');
    expect(request.user).toContain('Irja: when does Rimi close?');
    expect(request.web).toBeDefined();
    expect(request.system[1]).not.toContain('Likes tea.');
    expect(request.clientTools!.map((tool) => tool.name)).toEqual(['find_places', 'get_weather', 'get_route', 'convert_currency']);
    expect([...scopes].sort()).toEqual(['album:read', 'relationship:read']);
    const [row] = await nextUsage();
    expect(row).toMatchObject({ mentionerId: 'u-tom', mentionerEmail: 'tom@example.com', unasked: true, outcome: 'ok' });
  });

  it('keeps quiet when it has nothing to add, and still counts the call', async () => {
    const id = await readyChat();
    await letItJoinIn(id);
    ask.mockImplementation(async (request) => answer({ text: 'Skip.', servedBy: request.model }));

    await send(id, 'ok see you at home', IRJA);
    await nextUsage();
    await settle();
    expect(await botMessages(id)).toHaveLength(0);
  });

  it('is likelier to answer a question than to chime in on anything else', async () => {
    const id = await readyChat();
    await letItJoinIn(id);
    dice.mockReturnValue(0.3);

    await send(id, 'ok see you at home', IRJA);
    await settle();
    expect(ask).not.toHaveBeenCalled();

    await send(id, 'what should we watch?', IRJA);
    await nextUsage();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('waits for a pause, and keeps hours between two', async () => {
    const id = await readyChat();
    await letItJoinIn(id);

    await send(id, 'what should we eat?', IRJA);
    await send(id, 'something warm maybe');
    await nextUsage();
    await settle();
    // The first was cut off by the second; only the pause after the second counted.
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0]![0].user).toContain('Tom: something warm maybe');

    await send(id, 'and after that a film?', IRJA);
    await settle();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it('says nothing in the thread when it cannot answer', async () => {
    const id = await readyChat();
    await letItJoinIn(id);
    const before = (await systemLines(id)).length;
    ask.mockRejectedValue(Object.assign(new Error('overloaded'), { status: 529 }));

    await send(id, 'what is the weather tomorrow?', IRJA);
    await nextUsage();
    await settle();
    expect(await systemLines(id)).toHaveLength(before);
    expect(await botMessages(id)).toHaveLength(0);
  });
});
