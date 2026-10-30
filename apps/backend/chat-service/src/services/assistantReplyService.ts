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
import { MODELS, cheapestOf, costUnits } from './assistantModels';
import { placeTools } from './placeFinder';
import { chatTools } from './chatTools';
import { currencyTools } from './currency';
import { travelTools } from './travel';
import { weatherTools } from './weather';
import { chatText, withSources } from './chatText';
import { BASE_PROMPT, SKIP, WEB_RULES, WEB_USES_PER_REPLY, botPrompt, joinInMessage, userMessage } from './assistantPrompt';
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
/** Joining in unasked, it only talks: it may read the journal and photos, never change them. */
const READ_SCOPES: ApiKeyScope[] = ['relationship:read', 'album:read'];
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
const PLACE = { city: 'Tallinn', timeZone: 'Europe/Tallinn' } as const;


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
  if (!message.body.includes('@') && !repliedBotId(message)) {
    void maybeJoinIn(conversation._id.toString(), message).catch((error: Error) =>
      logger.error('Assistant join-in failed', { error: error.message, stack: error.stack })
    );
    return;
  }
  void answerMentions(person, conversation._id.toString(), message).catch((error: Error) =>
    logger.error('Assistant reply failed', { error: error.message, stack: error.stack })
  );
}

/**
 * Joining in unasked: a bot whose owner turned it on now and then answers a
 * question people asked each other, or adds a line, without being mentioned.
 *
 * Rare by design, and cheap when it does not happen: a roll of the dice on a
 * message nobody addressed to a bot (better odds for a question), a gap of
 * hours between two, and a pause to wait out, so it never cuts into a
 * conversation still going. Only then is Claude asked, on the owner's
 * allowance, and it may still answer SKIP and post nothing. Only a line that
 * was posted keeps the hours: a SKIP holds it back for a few minutes, so a
 * lucky roll on a dull moment does not cost it the next good one. It only talks: no
 * writing to the journal, no notes, no live locations, nothing its owner told
 * it in private. Every failure is silent, since nobody is waiting for it.
 */
export const JOIN_IN = {
  questionChance: 0.5,
  otherChance: 0.1,
  gapMs: 2 * 60 * 60_000,
  /** How long it waits before trying again when it looked and said nothing, or could not. */
  retryMs: 10 * 60_000,
  quietMs: 20_000
};

const isQuestion = (body: string): boolean => body.includes('?');
/** "SKIP", give or take a full stop or the case: its way of saying nothing. */
const isSkip = (text: string): boolean => new RegExp(`^\\W*${SKIP}\\W*$`, 'i').test(text.trim());

async function maybeJoinIn(conversationId: string, message: MessageView): Promise<void> {
  const now = Date.now();
  const cutoff = new Date(now - JOIN_IN.gapMs);
  const willing = await ChatBot.find({ conversationId, joinsIn: true, paused: false, $or: [{ lastJoinedAt: null }, { lastJoinedAt: { $lt: cutoff } }] });
  if (willing.length === 0) return;
  if (Math.random() >= (isQuestion(message.body) ? JOIN_IN.questionChance : JOIN_IN.otherChance)) return;

  // Wait for a pause: if someone writes again meanwhile, this turn is gone.
  await new Promise((resolve) => setTimeout(resolve, JOIN_IN.quietMs));
  const latest = await Message.findOne({ conversationId, deletedAt: null, kind: { $ne: 'system' } }).sort({ createdAt: -1 });
  if (latest?._id.toString() !== message.id) return;

  // One bot, and claimed: two messages rolling at once must not both send it. The claim holds it
  // for `retryMs` only, by dating it that far short of the full gap; posting something makes it the whole gap.
  const pick = willing[Math.floor(Math.random() * willing.length)]!;
  const bot = await ChatBot.findOneAndUpdate(
    { _id: pick._id, joinsIn: true, paused: false, $or: [{ lastJoinedAt: null }, { lastJoinedAt: { $lt: cutoff } }] },
    { $set: { lastJoinedAt: new Date(now - JOIN_IN.gapMs + JOIN_IN.retryMs) } },
    { new: true }
  );
  if (!bot) return;

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) return;
  const group = await getGroupOwner(conversation.groupId).catch(() => null);
  if (!assistantsOn(conversation, group?.memberCount)) return;
  // On its owner's allowance and with their key, so it reaches only what they can.
  const owner = conversation.members.find((member) => member.userId === bot.ownerId);
  if (!owner) return;
  await replyAs(bot, { id: owner.userId, email: owner.email, name: bot.ownerName || owner.name || '', groups: [] }, conversation, null);
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

/**
 * One reply. `asked` is the message it answers, from `person`; null when it is
 * joining in unasked, and `person` is then its owner, whose allowance it uses.
 */
async function replyAs(bot: IChatBot, person: Caller, conversation: IConversation, asked: MessageView | null): Promise<void> {
  const unasked = asked === null;
  // Best effort: a line that could not be posted must not cost the usage record below.
  // Unasked, nobody is waiting, so nothing is said at all.
  const notice = async (text: string) => {
    if (unasked) return;
    await postSystemLine(person, conversation, text).catch((error: Error) => logger.warn('Assistant notice failed', { error: error.message }));
  };
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

  // Joining in is a short, read-only line nobody asked for, and often SKIP: it never needs the
  // model its owner picked for the things they ask, so it runs on the cheapest one enabled.
  const model = (unasked ? cheapestOf(key.models.enabled) : undefined) ?? effectiveModel(bot, key.models);
  const started = Date.now();
  // Unasked, it may yet decide to say nothing, so no "typing" is shown for it.
  const working = unasked ? { activity: () => {}, stop: () => {} } : showWorking(conversation, bot);
  let minted: Awaited<ReturnType<typeof createApiKey>> | null = null;
  let outcome: AssistantOutcome = 'ok';
  let reply: ClaudeReply | null = null;

  try {
    minted = await createApiKey({
      userId: person.id,
      userEmail: person.email,
      userName: person.name,
      name: `${bot.name} in chat`.slice(0, 60),
      scopes: unasked ? READ_SCOPES : SCOPES,
      tenants: [conversation.groupId],
      defaultTenant: conversation.groupId,
      expiresAt: new Date(Date.now() + KEY_LIFETIME_MS)
    });

    reply = await askClaude({
      apiKey: key.apiKey,
      model,
      system: [
        webOn() ? `${BASE_PROMPT}\n\n${WEB_RULES}` : BASE_PROMPT,
        botPrompt(
          // What its owner told it about themselves is theirs: it is not even read when someone else asks.
          { name: bot.name, ownerName: bot.ownerName, personality: bot.personality, aboutOwner: !unasked && person.id === bot.ownerId ? bot.aboutOwner : '' },
          conversation.assistants?.aboutUs ?? '',
          conversation.assistants?.memory ?? '',
          memoryOn(conversation)
        )
      ],
      // Notes, saved places and where people are: things it does or reads only when someone asks.
      // The order is kept as it always was: the tools are part of what the prompt cache matches.
      clientTools: [
        ...(unasked ? [] : memoryTools(conversation)),
        ...placeTools(conversation._id.toString()),
        ...weatherTools(conversation._id.toString(), PLACE.timeZone),
        ...(unasked ? [] : chatTools(conversation, person, PLACE.timeZone, asked.id)),
        ...travelTools(conversation._id.toString()),
        ...currencyTools(conversation._id.toString())
      ],
      user: unasked
        ? joinInMessage({ botName: bot.name, recent: await recent(conversation._id.toString()), photoAlbum: conversation.photoAlbum, now: new Date(), timeZone: PLACE.timeZone })
        : userMessage({
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

    if (unasked) {
      // Its choice to keep quiet, or a refusal nobody asked for: nothing is posted.
      const text = chatText(reply.text);
      if (!reply.refused && text && !isSkip(text)) {
        await postBotMessage(conversation, bot, { body: withSources(text, reply.sources) });
        // It spoke: now the hours between two count from here.
        await ChatBot.updateOne({ _id: bot._id }, { $set: { lastJoinedAt: new Date() } });
      }
      if (reply.refused) outcome = 'refused';
    } else if (reply.refused) {
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
    outcome,
    unasked
  });
  await chargeSpend(person.email, units);

  // One quiet heads-up, when this reply is the one that crossed 80%.
  if (!unasked && reply && before.percent !== null && before.percent < 80) {
    const after = await allowanceFor(person);
    if (after.percent !== null && after.percent >= 80 && !after.exhausted) {
      await notice(`${who} has used ${after.percent}% of this month's assistant allowance.`);
    }
  }
}

