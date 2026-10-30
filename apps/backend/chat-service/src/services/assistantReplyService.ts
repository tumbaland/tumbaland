import { randomUUID } from 'crypto';
import { PaymentRequiredError, createApiKey, deleteApiKey, getGroupOwner, logger, type ApiKeyScope } from '@tumbaland/backend-core';
import { AssistantUsage, type AssistantOutcome } from '../models/AssistantUsage';
import { ChatBot, type IChatBot } from '../models/ChatBot';
import { Conversation, type IConversation } from '../models/Conversation';
import { Message } from '../models/Message';
import type { Caller } from './accessService';
import { askClaude, type ClaudeReply, type ToolCall } from './assistantClaude';
import { getActiveKey, markKeyRejected } from './assistantKeyService';
import { memoryOn, memoryTools } from './assistantMemory';
import { MODELS, costUnits } from './assistantModels';
import { placeTools } from './placeFinder';
import { chatTools } from './chatTools';
import { currencyTools } from './currency';
import { travelTools } from './travel';
import { weatherTools } from './weather';
import { chatText, withSources } from './chatText';
import { BASE_PROMPT, WEB_RULES, botPrompt, userMessage } from './assistantPrompt';
import { allowanceFor, assertCanAsk, chargeSpend } from './assistantUsageService';
import { assistantsOn, effectiveModel } from './botService';
import { touchConversation } from './conversationService';
import { findMentions } from './mentions';
import { postSystemLine } from './messageService';
import { toView, type MessageView } from './messageView';
import { notifyNewMessage } from './notificationService';
import { publishToGroup } from './streamHub';

/**
 * A person mentions an assistant; it answers.
 *
 * It runs after the person's message has been stored and returned, never inside
 * the send: a reply takes seconds to a minute, and a message must not wait on
 * Claude. Everything that can say no happens before a token is spent, and says
 * so in the thread, so nobody is left wondering why nothing came back.
 *
 * Whose data the bot reaches is decided here, by whose key it is handed. It is
 * always the key of the person who asked, minted for five minutes, pinned to
 * this conversation's group, with no money scope. Neither the bot's owner nor
 * the prompt can widen that.
 */

const BOT_EMAIL = 'assistant@tumbaland.eu';
const KEY_LIFETIME_MS = 5 * 60_000;
/** Journal and photos. Money is left out: a reply is read by everyone in the chat. */
const SCOPES: ApiKeyScope[] = ['relationship:read', 'relationship:write', 'album:read', 'album:write'];
const RECENT_MESSAGES = 30;
const REPLY_LIMIT = 4000;
const TYPING_EVERY_MS = 3000;

const mcpUrl = (): string => `${(process.env.MCP_PUBLIC_URL || 'https://mcp.tumbaland.eu').replace(/\/$/, '')}/mcp`;

const botCaller = (bot: IChatBot): Caller => ({ id: `bot:${bot._id.toString()}`, email: BOT_EMAIL, name: bot.name, groups: [] });

/** What the typing line says while a tool runs. Unknown tools fall back to the plain "working on it". */
const ACTIVITY: Record<string, string> = {
  create_collage: 'making a collage',
  update_collage: 'making a collage',
  view_collage: 'making a collage',
  plan_event: 'planning',
  edit_plan: 'planning',
  log_day: 'writing in the journal',
  log_activity: 'writing in the journal',
  edit_activity: 'writing in the journal',
  search_photos: 'looking at photos',
  view_photos: 'looking at photos',
  get_photo_memories: 'looking at photos',
  tag_photos: 'tidying photos',
  create_album: 'making an album',
  web_search: 'searching the web',
  web_fetch: 'reading a web page',
  find_places: 'looking for places',
  get_weather: 'checking the weather',
  search_chat: 'searching the chat',
  where_is: 'checking the map',
  get_route: 'working out the route',
  convert_currency: 'converting money',
  saved_places: 'checking saved places',
  remember: 'making a note',
  forget: 'making a note'
};

/** Where the chats are. One place for now: the people who use Tumbaland live there. */
const PLACE = { city: 'Tallinn', country: 'EE', timeZone: 'Europe/Tallinn' } as const;

/** Searches and pages one reply may use. Each search costs a cent and each page adds input tokens. */
const WEB_USES_PER_REPLY = 5;

const webOn = (): boolean => process.env.ASSISTANT_WEB !== 'off';
export const activityFor = (tool: string): string => ACTIVITY[tool] ?? 'working on it';

/**
 * Entry point, called once for a person's new text message. Never throws and
 * never waits: a failure here is logged, because the message it answers is
 * already stored and delivered.
 */
export function triggerAssistants(person: Caller, conversation: IConversation, message: MessageView): void {
  // Only a person's words wake a bot: a bot that could wake a bot would answer itself forever, at our cost.
  if (message.kind !== 'text' || message.botId) return;
  // An @, or a reply to something a bot said: answering it is asking it again.
  if (!message.body.includes('@') && !repliedBotId(message)) return;
  void answerMentions(person, conversation._id.toString(), message).catch((error: Error) =>
    logger.error('Assistant reply failed', { error: error.message, stack: error.stack })
  );
}

/** The bot a reply answers, when the quoted message was one of a bot's. */
const repliedBotId = (message: MessageView): string | null =>
  message.quote?.senderId?.startsWith('bot:') ? message.quote.senderId.slice('bot:'.length) : null;

async function answerMentions(person: Caller, conversationId: string, message: MessageView): Promise<void> {
  const bots = await ChatBot.find({ conversationId }).sort({ createdAt: 1 });
  if (bots.length === 0) return;

  const { bots: mentioned, claude } = findMentions(message.body, bots);
  const targets = mentioned.map((entry) => entry.bot);
  const add = (bot: (typeof bots)[number] | undefined) => {
    if (bot && !targets.some((target) => target._id.equals(bot._id))) targets.push(bot);
  };
  // "@Claude" means your own assistant, if you have one.
  if (claude) add(bots.find((bot) => bot.ownerId === person.id));
  // A reply to a bot asks that bot, unless the reply names others and not it: then they are who was asked.
  const replied = repliedBotId(message);
  if (replied && targets.length === 0) add(bots.find((bot) => bot._id.toString() === replied));
  if (targets.length === 0) return;

  // Read again, not taken from the request: consent may have changed since.
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return;
  const group = await getGroupOwner(conversation.groupId).catch(() => null);
  if (!assistantsOn(conversation, group?.memberCount)) {
    await postSystemLine(person, conversation, 'Assistants are off in this chat. Anyone here can turn them on, under Assistants in the chat menu.');
    return;
  }

  // One after another, so a second bot reads what the first one said.
  for (const bot of targets) await replyAs(bot, person, conversation, message);
}

async function postBotMessage(
  conversation: IConversation,
  bot: IChatBot,
  content: { body: string; collage?: { id: string; title: string } }
): Promise<void> {
  const conversationId = conversation._id.toString();
  const message = await Message.create({
    conversationId,
    senderEmail: BOT_EMAIL,
    senderId: `bot:${bot._id.toString()}`,
    senderName: bot.name,
    botId: bot._id.toString(),
    kind: content.collage ? 'collage' : 'text',
    body: content.body.slice(0, REPLY_LIMIT),
    collage: content.collage ?? null,
    clientId: `assistant-${randomUUID()}`
  });
  await touchConversation(conversationId, content.collage ? `Collage: ${content.collage.title}` : content.body, bot.name, message.createdAt);
  const view = toView(message);
  publishToGroup(conversation.groupId, { type: 'message.created', conversationId, at: message.createdAt.getTime(), payload: view });
  // Nobody has read it yet, so everyone in the chat is told, like a reminder.
  void notifyNewMessage(conversation, botCaller(bot), view);
}

/** The collage a reply made, found in what its tool said: `Made "Title" (id 64a...), empty, ...`. */
export function collageFrom(toolCalls: ToolCall[]): { id: string; title: string } | null {
  for (const call of toolCalls) {
    if (call.name !== 'create_collage' || call.isError) continue;
    const match = /Made "(.+)" \(id ([0-9a-f]{24})\)/s.exec(call.result);
    if (match) return { id: match[2]!, title: match[1]! };
  }
  return null;
}

/** "Tumbi is making a collage": re-sent every few seconds, because a typing line fades on its own. */
function showWorking(conversation: IConversation, bot: IChatBot): { activity: (tool: string) => void; stop: () => void } {
  let activity = '';
  const send = () =>
    publishToGroup(conversation.groupId, {
      type: 'typing',
      conversationId: conversation._id.toString(),
      at: Date.now(),
      payload: { userId: `bot:${bot._id.toString()}`, name: bot.name, bot: true, activity }
    });
  send();
  const timer = setInterval(send, TYPING_EVERY_MS);
  return {
    activity: (tool) => {
      activity = activityFor(tool);
      send();
    },
    stop: () => clearInterval(timer)
  };
}

async function recent(conversationId: string) {
  const rows = await Message.find({ conversationId, deletedAt: null, kind: { $ne: 'system' } })
    .sort({ createdAt: -1 })
    .limit(RECENT_MESSAGES);
  return rows.reverse();
}

const resetsLine = (resetsOn: string): string =>
  new Date(`${resetsOn}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });

async function replyAs(bot: IChatBot, person: Caller, conversation: IConversation, asked: MessageView): Promise<void> {
  // Best effort: a line that could not be posted must not cost the usage record below.
  const notice = (text: string) =>
    postSystemLine(person, conversation, text).catch((error: Error) => logger.warn('Assistant notice failed', { error: error.message }));
  const who = person.name || 'Someone';

  if (bot.paused) return void (await notice(`${bot.name} is paused.`));

  const key = await getActiveKey();
  if (!key) return void (await notice(`${bot.name} isn't available right now.`));

  let before: Awaited<ReturnType<typeof assertCanAsk>>;
  try {
    before = await assertCanAsk(person);
  } catch (error) {
    // The allowance is the one stop with a day it ends; the rest are a pause and say so themselves.
    if (error instanceof PaymentRequiredError) {
      const { resetsOn } = await allowanceFor(person);
      // Everyone in the chat reads this line, so it names who it is about.
      return void (await notice(`${who} has used this month's assistant allowance. It starts again on ${resetsLine(resetsOn)}.`));
    }
    return void (await notice((error as Error).message));
  }

  const model = effectiveModel(bot, key.models);
  const started = Date.now();
  const working = showWorking(conversation, bot);
  let minted: Awaited<ReturnType<typeof createApiKey>> | null = null;
  let outcome: AssistantOutcome = 'ok';
  let reply: ClaudeReply | null = null;

  try {
    minted = await createApiKey({
      userId: person.id,
      userEmail: person.email,
      userName: person.name,
      name: `${bot.name} in chat`.slice(0, 60),
      scopes: SCOPES,
      tenants: [conversation.groupId],
      defaultTenant: conversation.groupId,
      expiresAt: new Date(Date.now() + KEY_LIFETIME_MS)
    });

    reply = await askClaude({
      apiKey: key.apiKey,
      model,
      system: [webOn() ? `${BASE_PROMPT}\n\n${WEB_RULES}` : BASE_PROMPT, botPrompt(bot, conversation.assistants?.aboutUs ?? '', conversation.assistants?.memory ?? '', memoryOn(conversation))],
      clientTools: [...memoryTools(conversation), ...placeTools(conversation._id.toString()), ...weatherTools(conversation._id.toString(), PLACE.timeZone), ...chatTools(conversation, person, PLACE.timeZone, asked.id), ...travelTools(conversation._id.toString()), ...currencyTools(conversation._id.toString())],
      user: userMessage({
        asker: person.name || 'Someone',
        asked: asked.body,
        botName: bot.name,
        recent: await recent(conversation._id.toString()),
        photoAlbum: conversation.photoAlbum,
        now: new Date(),
        timeZone: PLACE.timeZone
      }),
      web: webOn() ? { ...PLACE, maxUses: WEB_USES_PER_REPLY } : undefined,
      mcpUrl: mcpUrl(),
      mcpToken: minted.token,
      onTool: working.activity
    });

    if (reply.refused) {
      outcome = 'refused';
      await postBotMessage(conversation, bot, { body: "I can't help with that one." });
    } else {
      const collage = collageFrom(reply.toolCalls);
      // A reply with no words but work done is still an answer.
      const text = chatText(reply.text);
      await postBotMessage(conversation, bot, { body: text ? withSources(text, reply.sources) : reply.toolCalls.length ? 'Done.' : '...' });
      if (collage) await postBotMessage(conversation, bot, { body: '', collage });
    }
  } catch (error) {
    const status = (error as { status?: number }).status;
    logger.error('Assistant call failed', { bot: bot.name, model, status, error: (error as Error).message });
    if (status === 401) {
      // Only an authentication failure says the key itself is bad. A 403 can be a model or a
      // feature this account may not use, and taking the key away for everyone over it would be wrong.
      outcome = 'key_rejected';
      await markKeyRejected('Anthropic answered 401').catch(() => undefined);
      await notice(`${bot.name} isn't available right now.`);
    } else if (status === 403) {
      outcome = 'error';
      await notice(`${bot.name} isn't available right now.`);
    } else {
      outcome = 'error';
      await notice(status === 429 || status === 529 ? `${bot.name} is busy. Try again in a minute.` : `${bot.name} could not answer that. Try again in a moment.`);
    }
  } finally {
    working.stop();
    if (minted) await deleteApiKey(person.id, minted.summary.id).catch(() => undefined);
  }

  // Charged by what Anthropic reports it used, to whoever asked.
  const served = reply?.servedBy ?? MODELS[model].id;
  const tokens = reply?.usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const units = reply ? costUnits(served, tokens) : 0;
  await AssistantUsage.create({
    conversationId: conversation._id.toString(),
    groupId: conversation.groupId,
    botId: bot._id.toString(),
    botName: bot.name,
    mentionerId: person.id,
    mentionerEmail: person.email,
    modelId: served,
    inputTokens: tokens.input,
    outputTokens: tokens.output,
    cacheReadTokens: tokens.cacheRead,
    cacheWriteTokens: tokens.cacheWrite,
    units,
    durationMs: Date.now() - started,
    outcome
  });
  await chargeSpend(person.email, units);

  // One quiet heads-up, when this reply is the one that crossed 80%.
  if (reply && before.percent !== null && before.percent < 80) {
    const after = await allowanceFor(person);
    if (after.percent !== null && after.percent >= 80 && !after.exhausted) {
      await notice(`${who} has used ${after.percent}% of this month's assistant allowance.`);
    }
  }
}

