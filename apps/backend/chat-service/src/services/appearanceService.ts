import { BadRequestError } from '@tumbaland/backend-core';
import { Conversation, IAppearanceSetting, IConversation } from '../models/Conversation';
import { Message } from '../models/Message';
import type { Caller } from './accessService';
import { getDownloadUrls } from './fileServiceClient';
import { postSystemLine } from './messageService';
import { publishToGroup } from './streamHub';

/**
 * How a conversation looks: a preset theme and, optionally, one of its own
 * photos as the background. Shared by everyone in it, like the album setting,
 * and announced in the thread when it changes.
 *
 * The themes themselves (colours, gradients) live in chat-front. The service
 * only knows their names, so a theme can be restyled without a deploy here.
 */
export const THEMES = [
  'classic',
  'ocean',
  'forest',
  'sunset',
  'lavender',
  'graphite',
  'rose',
  'teal',
  'amber',
  'midnight',
  'berry',
  'cocoa'
] as const;
export type ThemeId = (typeof THEMES)[number];

/**
 * Display names, for the line in the thread. Kept in step with chat-front's
 * list by a test there, which reads this file.
 */
const THEME_NAMES: Record<ThemeId, string> = {
  classic: 'Classic',
  ocean: 'Ocean',
  forest: 'Forest',
  sunset: 'Sunset',
  lavender: 'Lavender',
  graphite: 'Graphite',
  rose: 'Rose',
  teal: 'Teal',
  amber: 'Amber',
  midnight: 'Midnight',
  berry: 'Berry',
  cocoa: 'Cocoa'
};

export interface AppearanceView {
  theme: ThemeId;
  backgroundFileId: string | null;
  /** Signed and short-lived, minted per response like every attachment URL. */
  backgroundUrl: string | null;
}

const themeOf = (setting?: IAppearanceSetting | null): ThemeId =>
  (THEMES as readonly string[]).includes(setting?.theme ?? '') ? (setting!.theme as ThemeId) : 'classic';

export async function appearanceView(setting?: IAppearanceSetting | null): Promise<AppearanceView> {
  const backgroundFileId = setting?.backgroundFileId ?? null;
  const urls = backgroundFileId ? await getDownloadUrls([backgroundFileId]) : new Map<string, string>();
  return {
    theme: themeOf(setting),
    backgroundFileId,
    backgroundUrl: backgroundFileId ? (urls.get(backgroundFileId) ?? null) : null
  };
}

async function announce(conversation: IConversation, setting: IAppearanceSetting): Promise<AppearanceView> {
  const view = await appearanceView(setting);
  publishToGroup(conversation.groupId, {
    type: 'conversation.updated',
    conversationId: conversation._id.toString(),
    at: Date.now(),
    payload: { appearance: view }
  });
  return view;
}

export interface AppearanceChange {
  theme?: string;
  /** A photo sent in this conversation, or null to remove the background. */
  backgroundFileId?: string | null;
}

/** Changes the theme, the background photo, or both, for everyone in the conversation. */
export async function setAppearance(
  person: Caller,
  conversation: IConversation,
  change: AppearanceChange
): Promise<AppearanceView> {
  const current = conversation.appearance;
  const setting: IAppearanceSetting = {
    theme: themeOf(current),
    backgroundFileId: current?.backgroundFileId ?? null
  };

  if (change.theme !== undefined) {
    if (!(THEMES as readonly string[]).includes(change.theme)) throw new BadRequestError('No such theme');
    setting.theme = change.theme;
  }

  if (change.backgroundFileId !== undefined) {
    if (change.backgroundFileId) {
      // Only a photo actually sent here, and still there: an id from anywhere
      // else would let the background point at a file this group cannot see.
      const source = await Message.findOne({
        conversationId: conversation._id.toString(),
        deletedAt: null,
        'attachments.fileId': change.backgroundFileId
      });
      const attachment = source?.attachments.find((candidate) => candidate.fileId === change.backgroundFileId);
      if (!attachment || !attachment.mimetype.startsWith('image/')) {
        throw new BadRequestError('The background has to be a photo from this conversation');
      }
    }
    setting.backgroundFileId = change.backgroundFileId;
  }

  await Conversation.updateOne({ _id: conversation._id }, { $set: { appearance: setting } });
  conversation.appearance = setting;

  const who = person.name || 'Someone';
  const lines: string[] = [];
  if (change.theme !== undefined && change.theme !== themeOf(current)) {
    lines.push(`${who} changed the theme to ${THEME_NAMES[setting.theme as ThemeId]}`);
  }
  if (change.backgroundFileId !== undefined && change.backgroundFileId !== (current?.backgroundFileId ?? null)) {
    lines.push(change.backgroundFileId ? `${who} set a chat background` : `${who} removed the chat background`);
  }
  for (const line of lines) await postSystemLine(person, conversation, line);

  return announce(conversation, setting);
}

/**
 * On unsend: a background pointing at a photo that is about to be deleted
 * goes with it, rather than leaving a broken image behind the thread.
 */
export async function forgetBackgroundIn(conversation: IConversation, fileIds: string[]): Promise<void> {
  const background = conversation.appearance?.backgroundFileId;
  if (!background || !fileIds.includes(background)) return;
  const setting: IAppearanceSetting = { theme: themeOf(conversation.appearance), backgroundFileId: null };
  await Conversation.updateOne({ _id: conversation._id }, { $set: { appearance: setting } });
  conversation.appearance = setting;
  await announce(conversation, setting);
}
