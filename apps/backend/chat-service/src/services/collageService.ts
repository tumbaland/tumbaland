import { BadRequestError, logger } from '@tumbaland/backend-core';
import { Types } from 'mongoose';
import { Conversation, IConversation } from '../models/Conversation';
import { IMessage, Message } from '../models/Message';
import type { Caller } from './accessService';
import * as albums from './albumClient';
import { announceNewMessage, toView, type MessageView } from './messageService';
import { withDownloadUrls } from './attachmentService';
import { isPushConfigured, sendToUsers } from './pushService';

/**
 * "Make a collage together" from a chat, and the nudge when someone works on it.
 *
 * The collage is made in Album on the album this chat's photos go to, so a
 * photo sent here lands in its photo tray. The chat gets a card with a Join
 * link. Album tells us, through `collageActivity`, when someone opens it.
 */

export interface StartCollageInput {
  clientId: string;
  title: string;
}

async function stored(conversationId: string, clientId: string): Promise<MessageView | null> {
  const existing = await Message.findOne({ conversationId, clientId });
  if (!existing) return null;
  const [view] = await withDownloadUrls([toView(existing)]);
  return view!;
}

/**
 * Makes the collage and posts its card. Idempotent on `clientId` like a send,
 * checked before Album is asked, so a retry does not make a second collage.
 */
export async function startCollage(
  person: Caller,
  conversation: IConversation,
  input: StartCollageInput
): Promise<{ message: MessageView; created: boolean }> {
  const conversationId = conversation._id.toString();
  const retry = await stored(conversationId, input.clientId);
  if (retry) return { message: retry, created: false };

  const setting = conversation.photoAlbum;
  if (setting?.mode !== 'album' || !setting.albumId) {
    throw new BadRequestError('Choose an album for this chat’s photos first');
  }

  const title = input.title.trim();
  let collage: { id: string; title: string };
  try {
    collage = await albums.createCollage(conversation.groupId, {
      clientId: input.clientId,
      userId: person.id,
      albumId: setting.albumId,
      conversationId,
      title
    });
  } catch (error) {
    if (error instanceof albums.AlbumGoneError) {
      throw new BadRequestError('This chat’s album no longer exists. Choose another one first.');
    }
    throw error;
  }

  let message: IMessage;
  try {
    message = await Message.create({
      conversationId,
      senderEmail: person.email,
      senderId: person.id,
      senderName: person.name,
      kind: 'collage',
      body: '',
      collage,
      clientId: input.clientId
    });
  } catch (error) {
    // Concurrent retries share the same Album collage and keep one chat card.
    if ((error as { code?: number }).code !== 11000) throw error;
    const existing = await stored(conversationId, input.clientId);
    if (!existing) throw error;
    return { message: existing, created: false };
  }

  const view = await announceNewMessage(person, conversation, message, `Collage: ${collage.title}`);
  return { message: view, created: true };
}

export interface CollageActivity {
  conversationId: string;
  collageId: string;
  title: string;
  userId: string;
  name: string;
  /** Who has the collage open already, and so needs no telling. */
  presentUserIds: string[];
}

/**
 * "Tom is working on your collage", to everyone else in the chat who is not
 * in the collage already. Album decides when (and how often); this only
 * decides who. Never throws: it is a nudge.
 */
export async function collageActivity(activity: CollageActivity): Promise<number> {
  try {
    if (!isPushConfigured() || !Types.ObjectId.isValid(activity.conversationId)) return 0;
    const conversation = await Conversation.findOne({ _id: activity.conversationId, deletedAt: null });
    if (!conversation) return 0;

    const present = new Set([activity.userId, ...activity.presentUserIds]);
    const recipients = conversation.members.map((member) => member.userId).filter((userId) => !present.has(userId));
    if (recipients.length === 0) return 0;

    return await sendToUsers(
      recipients,
      {
        title: activity.name,
        body: `${activity.name} is working on your collage “${activity.title}”`,
        // One line per collage in the shade, however often it is opened.
        tag: `collage-${activity.collageId}`,
        url: `/album/collages/${activity.collageId}`
      },
      { topic: activity.collageId.slice(0, 32) }
    );
  } catch (error) {
    logger.warn('Collage activity notification failed', { error: (error as Error).message });
    return 0;
  }
}
