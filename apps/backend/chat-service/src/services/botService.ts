import { BadRequestError, ForbiddenError, NotFoundError, getGroupOwner, logger } from '@tumbaland/backend-core';
import { Types } from 'mongoose';
import { BOT_COLORS, ChatBot, type IChatBot } from '../models/ChatBot';
import { Conversation, type IAssistantsSetting, type IConversation } from '../models/Conversation';
import type { Caller } from './accessService';
import { getModelSettings, type ModelSettings } from './assistantKeyService';
import { MODELS, modelCatalog, type ModelId } from './assistantModels';
import { allowanceFor, type AllowanceView } from './assistantUsageService';
import { isGroupManager } from './groupRoleClient';
import { postSystemLine } from './messageService';
import { sendToUsers } from './pushService';
import { publishToGroup } from './streamHub';

/**
 * The assistants in a conversation: who has agreed to them, and the bots
 * people have added.
 *
 * Three people may change a bot: whoever made it, and the owner and admins of
 * the group. Nobody else can, but everybody in the conversation can read what it
 * was told, because a bot reads a chat two people share. An admin's edit never
 * makes the bot theirs, and the bot's owner is told.
 *
 * Consent is each person's own. An admin can switch assistants off for the whole
 * conversation, and decide whether everyone may add a bot or only admins, but
 * can never switch them on for anyone.
 */

/** Starting points, so nobody faces an empty box. Plain words, no em dashes. */
export const PRESETS = [
  { id: 'warm', name: 'Warm and brief', personality: 'Warm and kind. Keep replies to a sentence or two unless asked for more.' },
  { id: 'playful', name: 'Playful', personality: 'Playful and a little cheeky, with the odd emoji. Never mean.' },
  { id: 'planner', name: 'The planner', personality: 'Organised and practical. Likes dates, lists and getting things into the calendar.' },
  { id: 'quiet', name: 'Quiet helper', personality: 'Says as little as it can. Does what is asked and confirms in a few words.' }
] as const;

/** Typed after the @ as an alias for the mentioner's own bot, so it is not a name a bot can take. */
export const RESERVED_NAMES = ['claude'];

/**
 * A plain copy of the setting. Not the subdocument itself: spreading one copies
 * Mongoose's internals and drops the fields, which is how a change would quietly
 * save nothing.
 */
const settingOf = (conversation: IConversation): IAssistantsSetting => {
  const setting = conversation.assistants;
  return {
    enabledBy: [...(setting?.enabledBy ?? [])],
    aboutUs: setting?.aboutUs ?? '',
    lockedOff: setting?.lockedOff ?? false,
    whoCanAdd: setting?.whoCanAdd ?? 'everyone'
  };
};

/**
 * Whether assistants are on here: nobody has locked them off, and everyone who
 * has opened the conversation has agreed. `groupSize` is how many people the
 * group has; one who has never opened the chat has not agreed either, so a
 * conversation with fewer people seen than the group has is not on yet.
 */
export function assistantsOn(conversation: IConversation, groupSize?: number | null): boolean {
  const setting = settingOf(conversation);
  if (setting.lockedOff || conversation.members.length === 0) return false;
  if (groupSize && conversation.members.length < groupSize) return false;
  return conversation.members.every((member) => setting.enabledBy.includes(member.userId));
}

export interface BotView {
  id: string;
  name: string;
  personality: string;
  aboutOwner: string;
  color: string;
  /** The model it will actually answer with: its own, unless admin has since turned that one off. */
  model: ModelId;
  modelLabel: string;
  paused: boolean;
  ownerId: string;
  ownerName: string;
  /** The viewer made it. */
  mine: boolean;
  /** The viewer may edit, pause or delete it. */
  canManage: boolean;
}

export interface AssistantsView {
  /** On right now: everyone agreed and nobody locked it. */
  enabled: boolean;
  /** The viewer has agreed. */
  mine: boolean;
  /** Who has not agreed yet. */
  waitingFor: string[];
  lockedOff: boolean;
  whoCanAdd: 'everyone' | 'admins';
  aboutUs: string;
  /** The viewer is an owner or admin of the group. */
  isManager: boolean;
  /** The viewer may add a bot: they have none yet, and `whoCanAdd` allows them. */
  canAdd: boolean;
  bots: BotView[];
  presets: typeof PRESETS;
  colors: readonly string[];
  /** Only the models admin has turned on, as the bot editor offers them. */
  models: { options: ReturnType<typeof modelCatalog>; default: ModelId };
  allowance: AllowanceView;
}

export const effectiveModel = (bot: IChatBot, models: ModelSettings): ModelId =>
  models.enabled.includes(bot.modelId) ? bot.modelId : models.default;

const toView = (bot: IChatBot, person: Caller, isManager: boolean, models: ModelSettings): BotView => {
  const model = effectiveModel(bot, models);
  return {
    id: bot._id.toString(),
    name: bot.name,
    personality: bot.personality,
    aboutOwner: bot.aboutOwner,
    color: bot.color,
    model,
    modelLabel: MODELS[model].label,
    paused: bot.paused,
    ownerId: bot.ownerId,
    ownerName: bot.ownerName,
    mine: bot.ownerId === person.id,
    canManage: bot.ownerId === person.id || isManager
  };
};

/** "1 person who has not opened this chat yet": someone in the group who cannot have agreed. */
const unseen = (count: number): string =>
  `${count} ${count === 1 ? 'person who has' : 'people who have'} not opened this chat yet`;

export async function assistantsView(person: Caller, conversation: IConversation): Promise<AssistantsView> {
  const setting = settingOf(conversation);
  const [bots, isManager, models, allowance, group] = await Promise.all([
    ChatBot.find({ conversationId: conversation._id.toString() }).sort({ createdAt: 1 }),
    isGroupManager(conversation.groupId, person.email),
    getModelSettings(),
    allowanceFor(person),
    // The same question the reply path asks, so the dialog never says "on" while replies say "off".
    getGroupOwner(conversation.groupId).catch(() => null)
  ]);
  const catalog = modelCatalog().filter((model) => models.enabled.includes(model.id));
  const hasBot = bots.some((bot) => bot.ownerId === person.id);
  const notSeen = Math.max(0, (group?.memberCount ?? 0) - conversation.members.length);
  return {
    enabled: assistantsOn(conversation, group?.memberCount),
    mine: setting.enabledBy.includes(person.id),
    waitingFor: [
      ...conversation.members.filter((member) => !setting.enabledBy.includes(member.userId)).map((member) => member.name || member.email),
      ...(notSeen > 0 ? [unseen(notSeen)] : [])
    ],
    lockedOff: setting.lockedOff,
    whoCanAdd: setting.whoCanAdd,
    aboutUs: setting.aboutUs,
    isManager,
    canAdd: !hasBot && (setting.whoCanAdd === 'everyone' || isManager),
    bots: bots.map((bot) => toView(bot, person, isManager, models)),
    presets: PRESETS,
    colors: BOT_COLORS,
    models: { options: catalog, default: models.default },
    allowance
  };
}

/** Tells every open thread to reload what the assistants dialog shows. */
function announce(conversation: IConversation): void {
  publishToGroup(conversation.groupId, {
    type: 'conversation.updated',
    conversationId: conversation._id.toString(),
    at: Date.now(),
    payload: { assistants: true }
  });
}

/** Best effort: a missed notice costs a buzz, a failed edit would cost the edit. */
async function tellOwner(conversation: IConversation, person: Caller, bot: IChatBot, what: string): Promise<void> {
  if (bot.ownerId === person.id) return;
  await sendToUsers([bot.ownerId], {
    title: 'Your assistant was changed',
    body: `${person.name || 'Someone'} ${what}`,
    tag: `bot-${bot._id.toString()}`,
    url: `/chat/${conversation._id.toString()}`
  }).catch((error: Error) => logger.warn('Bot change notice failed', { error: error.message }));
}

const who = (person: Caller): string => person.name || 'Someone';

// ─── Consent and settings ────────────────────────────────────────────────────

export interface SettingsChange {
  enabled?: boolean;
  aboutUs?: string;
  lockedOff?: boolean;
  whoCanAdd?: 'everyone' | 'admins';
}

export async function changeSettings(person: Caller, conversation: IConversation, change: SettingsChange): Promise<void> {
  const current = settingOf(conversation);
  const next: IAssistantsSetting = { ...current };
  const lines: string[] = [];

  if (change.lockedOff !== undefined || change.whoCanAdd !== undefined) {
    // Reaching a role is a call to group-service, so only when one is asked for.
    if (!(await isGroupManager(conversation.groupId, person.email))) {
      throw new ForbiddenError('Only the group owner or an admin can change that');
    }
  }

  if (change.enabled !== undefined && change.enabled !== current.enabledBy.includes(person.id)) {
    next.enabledBy = change.enabled ? [...current.enabledBy, person.id] : current.enabledBy.filter((id) => id !== person.id);
    lines.push(`${who(person)} turned assistants ${change.enabled ? 'on' : 'off'}`);
  }
  if (change.aboutUs !== undefined && change.aboutUs !== current.aboutUs) {
    next.aboutUs = change.aboutUs;
    lines.push(`${who(person)} updated what the assistants know about you`);
  }
  if (change.lockedOff !== undefined && change.lockedOff !== current.lockedOff) {
    next.lockedOff = change.lockedOff;
    lines.push(change.lockedOff ? `${who(person)} turned assistants off for this chat` : `${who(person)} allowed assistants in this chat again`);
  }
  if (change.whoCanAdd !== undefined && change.whoCanAdd !== current.whoCanAdd) {
    next.whoCanAdd = change.whoCanAdd;
    lines.push(change.whoCanAdd === 'admins' ? `${who(person)} made adding assistants admins only` : `${who(person)} let everyone add an assistant`);
  }
  if (lines.length === 0) return;

  await Conversation.updateOne({ _id: conversation._id }, { $set: { assistants: next } });
  conversation.assistants = next;
  for (const line of lines) await postSystemLine(person, conversation, line);
  announce(conversation);
}

// ─── Bots ────────────────────────────────────────────────────────────────────

const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

async function assertNameFree(conversation: IConversation, name: string, exceptBotId?: string): Promise<void> {
  if (RESERVED_NAMES.some((reserved) => sameName(reserved, name))) throw new BadRequestError(`"${name}" is taken`);
  if (conversation.members.some((member) => sameName(member.name, name))) {
    throw new BadRequestError(`"${name}" is already the name of someone in this chat`);
  }
  const bots = await ChatBot.find({ conversationId: conversation._id.toString() });
  if (bots.some((bot) => bot._id.toString() !== exceptBotId && sameName(bot.name, name))) {
    throw new BadRequestError(`There is already an assistant called ${name} here`);
  }
}

export interface BotInput {
  name: string;
  personality?: string;
  aboutOwner?: string;
  color?: string;
  model?: ModelId;
}

async function assertModelAllowed(model: ModelId): Promise<void> {
  const settings = await getModelSettings();
  if (!settings.enabled.includes(model)) throw new BadRequestError('That model is not available');
}

export async function createBot(person: Caller, conversation: IConversation, input: BotInput): Promise<void> {
  const setting = settingOf(conversation);
  const isManager = await isGroupManager(conversation.groupId, person.email);
  if (setting.whoCanAdd === 'admins' && !isManager) throw new ForbiddenError('Only the group owner or an admin can add an assistant here');

  const conversationId = conversation._id.toString();
  if (await ChatBot.exists({ conversationId, ownerId: person.id })) throw new BadRequestError('You already have an assistant in this chat');
  await assertNameFree(conversation, input.name);

  const models = await getModelSettings();
  if (input.model && !models.enabled.includes(input.model)) throw new BadRequestError('That model is not available');
  const taken = new Set((await ChatBot.find({ conversationId })).map((bot) => bot.color));

  let bot: IChatBot;
  try {
    bot = await ChatBot.create({
      conversationId,
      ownerId: person.id,
      ownerName: person.name,
      name: input.name,
      personality: input.personality ?? '',
      aboutOwner: input.aboutOwner ?? '',
      color: input.color ?? BOT_COLORS.find((color) => !taken.has(color)) ?? BOT_COLORS[0],
      modelId: input.model ?? models.default,
      updatedById: person.id
    });
  } catch (error) {
    // Two taps on "Add" at once: the unique index decides, and the loser is told why.
    if ((error as { code?: number }).code === 11000) throw new BadRequestError('You already have an assistant in this chat');
    throw error;
  }

  await postSystemLine(person, conversation, `${who(person)} added the assistant ${bot.name}`);
  announce(conversation);
}

export interface BotChange extends Partial<BotInput> {
  paused?: boolean;
}

async function requireBot(conversation: IConversation, botId: string): Promise<IChatBot> {
  if (!Types.ObjectId.isValid(botId)) throw new NotFoundError('Assistant not found');
  const bot = await ChatBot.findOne({ _id: botId, conversationId: conversation._id.toString() });
  if (!bot) throw new NotFoundError('Assistant not found');
  return bot;
}

async function requireManage(person: Caller, conversation: IConversation, bot: IChatBot): Promise<void> {
  if (bot.ownerId === person.id) return;
  if (await isGroupManager(conversation.groupId, person.email)) return;
  throw new ForbiddenError('Only the owner of this assistant, or a group admin, can change it');
}

export async function updateBot(person: Caller, conversation: IConversation, botId: string, change: BotChange): Promise<void> {
  const bot = await requireBot(conversation, botId);
  await requireManage(person, conversation, bot);

  const lines: string[] = [];
  const before = bot.name;
  if (change.name !== undefined && change.name !== bot.name) {
    await assertNameFree(conversation, change.name, botId);
    bot.name = change.name;
    // Fixing the capitals of a name is not worth a line in the thread.
    if (!sameName(before, change.name)) lines.push(`${who(person)} renamed the assistant ${before} to ${bot.name}`);
  }
  if (change.personality !== undefined && change.personality !== bot.personality) {
    bot.personality = change.personality;
    lines.push(`${who(person)} changed how ${bot.name} talks`);
  }
  if (change.aboutOwner !== undefined) bot.aboutOwner = change.aboutOwner;
  if (change.color !== undefined) bot.color = change.color;
  if (change.model !== undefined && change.model !== bot.modelId) {
    await assertModelAllowed(change.model);
    bot.modelId = change.model;
    lines.push(`${who(person)} switched ${bot.name} to ${MODELS[change.model].label}`);
  }
  if (change.paused !== undefined && change.paused !== bot.paused) {
    bot.paused = change.paused;
    lines.push(`${who(person)} ${change.paused ? 'paused' : 'resumed'} ${bot.name}`);
  }

  bot.updatedById = person.id;
  await bot.save();
  for (const line of lines) await postSystemLine(person, conversation, line);
  if (lines.length > 0) void tellOwner(conversation, person, bot, lines[lines.length - 1]!.slice(who(person).length + 1));
  announce(conversation);
}

export async function deleteBot(person: Caller, conversation: IConversation, botId: string): Promise<void> {
  const bot = await requireBot(conversation, botId);
  await requireManage(person, conversation, bot);
  await bot.deleteOne();
  await postSystemLine(person, conversation, `${who(person)} removed ${bot.name}`);
  void tellOwner(conversation, person, bot, `removed ${bot.name}`);
  announce(conversation);
}
