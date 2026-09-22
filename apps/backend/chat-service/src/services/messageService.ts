import { Types } from 'mongoose';
import { BadRequestError, ForbiddenError, NotFoundError, logger } from '@tumbaland/backend-core';
import { Conversation, IConversation } from '../models/Conversation';
import { IAttachment, IMessage, Message } from '../models/Message';
import { belongsToConversation, bytesOf, fileIdsOf, folderFor, withDownloadUrls } from './attachmentService';
import { deleteFolder } from './fileServiceClient';
import { recordStoredBytes, releaseStoredBytes } from './storageUsage';
import { ReadState } from '../models/ReadState';
import type { Caller } from './accessService';
import { touchConversation } from './conversationService';
import { notifyNewMessage } from './notificationService';
import { publishToGroup } from './streamHub';

export const MESSAGE_PAGE_SIZE = 50;
export const MAX_MESSAGE_PAGE_SIZE = 100;

/**
 * An attachment as the client receives it: the stored record plus signed URLs,
 * minted per response because they expire.
 */
export interface AttachmentView extends IAttachment {
  url?: string | null;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
}

/** The wire shape. Mongoose documents carry `__v` and internals the client has no use for. */
export interface MessageView {
  id: string;
  conversationId: string;
  senderEmail: string;
  senderId: string;
  senderName: string;
  kind: string;
  body: string;
  attachments: AttachmentView[];
  replyTo: string | null;
  reactions: Array<{ userId: string; name: string; emoji: string; at: Date }>;
  clientId: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export function toView(document: IMessage): MessageView {
  // Attachments and reactions are Mongoose subdocuments. Convert before
  // enriching them: spreading a subdocument copies internals, not its fields.
  const message = document.toObject();
  return {
    id: message._id.toString(),
    conversationId: message.conversationId,
    senderEmail: message.senderEmail,
    senderId: message.senderId,
    senderName: message.senderName,
    kind: message.kind,
    // A deleted message keeps its place in the thread but gives up its content.
    // Blanking here rather than at delete time means an edit history or an
    // undelete stays possible without a migration.
    body: message.deletedAt ? '' : message.body,
    attachments: message.deletedAt ? [] : message.attachments,
    replyTo: message.replyTo ?? null,
    reactions: message.deletedAt ? [] : message.reactions,
    clientId: message.clientId,
    editedAt: message.editedAt ?? null,
    deletedAt: message.deletedAt ?? null,
    createdAt: message.createdAt
  };
}

/** A one-line summary for the conversation list. */
function preview(body: string, attachments: IAttachment[]): string {
  if (body.trim()) return body.trim();
  if (attachments.length === 0) return '';
  const video = attachments.some((attachment) => attachment.mimetype.startsWith('video/'));
  if (attachments.length === 1) return video ? 'Video' : 'Photo';
  return `${attachments.length} attachments`;
}

export interface SendInput {
  clientId: string;
  body?: string;
  attachments?: IAttachment[];
  replyTo?: string | null;
}

export interface SendResult {
  message: MessageView;
  /** False when this `clientId` had already been stored, i.e. a retry. */
  created: boolean;
}

/**
 * Stores a message, or returns the one already stored under this `clientId`.
 *
 * The duplicate case returns the existing message with `created: false` rather
 * than a 409. A retry after a dropped response is the client doing the right
 * thing, and answering it with an error would make the UI show a failure for a
 * message that was in fact delivered.
 */
export async function sendMessage(
  person: Caller,
  conversation: IConversation,
  input: SendInput
): Promise<SendResult> {
  const body = (input.body ?? '').trim();
  const attachments = input.attachments ?? [];

  if (!body && attachments.length === 0) {
    throw new BadRequestError('A message needs text or an attachment');
  }

  // Every file must be one uploaded into this conversation. The ids come from
  // the client, and this service later signs download URLs for them and
  // deletes their folders on unsend.
  const foreign = fileIdsOf(attachments).some(
    (fileId) => !belongsToConversation(fileId, conversation.groupId, conversation._id.toString())
  );
  if (foreign) {
    throw new BadRequestError('That file does not belong to this conversation');
  }

  if (input.replyTo) {
    if (!Types.ObjectId.isValid(input.replyTo)) {
      throw new BadRequestError('replyTo is not a message id');
    }
    // A reply must point inside the same conversation, or a message could be
    // used to probe whether an id exists in a thread the caller cannot read.
    const parent = await Message.findOne({
      _id: input.replyTo,
      conversationId: conversation._id.toString()
    });
    if (!parent) {
      throw new BadRequestError('The message being replied to is not in this conversation');
    }
  }

  const conversationId = conversation._id.toString();

  let message: IMessage;
  const created = true;
  try {
    message = await Message.create({
      conversationId,
      senderEmail: person.email,
      senderId: person.id,
      senderName: person.name,
      kind: attachments.length > 0 ? 'media' : 'text',
      body,
      attachments,
      replyTo: input.replyTo ?? null,
      clientId: input.clientId
    });
  } catch (error) {
    // The unique `{ conversationId, clientId }` index is the idempotency
    // mechanism; a duplicate here is the retry case, not a failure.
    if ((error as { code?: number }).code !== 11000) throw error;

    const existing = await Message.findOne({ conversationId, clientId: input.clientId });
    if (!existing) throw error;
    const [view] = await withDownloadUrls([toView(existing)]);
    return { message: view!, created: false };
  }

  await touchConversation(conversationId, preview(body, attachments), person.name, message.createdAt);

  // The bytes are already in storage by now: the browser PUT them to the
  // signed URL before this call. Recorded rather than re-checked, because the
  // gate ran when the URL was minted and refusing here would mean paying for
  // an object and then declining to record it.
  await recordStoredBytes(conversation.groupId, bytesOf(message));

  // A sender has read their own message by definition. Without this their own
  // send would come back as one unread.
  await markRead(person, conversationId, message._id.toString(), message.createdAt);

  const [view] = await withDownloadUrls([toView(message)]);
  publishToGroup(conversation.groupId, {
    type: 'message.created',
    conversationId,
    at: message.createdAt.getTime(),
    payload: view
  });

  // Push is best-effort and must never fail a send: the message is already
  // stored and the recipient's app will show it from the stream or the next
  // fetch regardless.
  void notifyNewMessage(conversation, person, view);

  return { message: view!, created };
}

export interface PageInput {
  /** ISO timestamp; returns messages strictly older than this. */
  before?: string;
  /** ISO timestamp; returns messages strictly newer than this, used on reconnect. */
  after?: string;
  limit?: number;
}

export interface MessagePage {
  messages: MessageView[];
  /** Cursor to pass as `before` for the next page, or null at the start of the thread. */
  nextCursor: string | null;
}

/**
 * A page of the thread, newest first.
 *
 * Cursored on `createdAt`, never on skip/offset: a live thread grows under a
 * reader, and an offset would silently repeat or drop messages every time
 * someone sends while another is scrolling back.
 */
export async function listMessages(conversationId: string, input: PageInput): Promise<MessagePage> {
  const limit = Math.min(Math.max(input.limit ?? MESSAGE_PAGE_SIZE, 1), MAX_MESSAGE_PAGE_SIZE);

  const query: Record<string, unknown> = { conversationId };
  if (input.before) {
    const before = new Date(input.before);
    if (Number.isNaN(before.getTime())) throw new BadRequestError('before is not a date');
    query.createdAt = { $lt: before };
  } else if (input.after) {
    const after = new Date(input.after);
    if (Number.isNaN(after.getTime())) throw new BadRequestError('after is not a date');
    query.createdAt = { $gt: after };
  }

  // One extra row answers "is there another page" without a second count query.
  const rows = await Message.find(query).sort({ createdAt: -1 }).limit(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    // One file-service call for the whole page, not one per attachment.
    messages: await withDownloadUrls(page.map(toView)),
    nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.createdAt.toISOString() : null
  };
}

/**
 * Re-points the conversation list's preview after an edit or an unsend.
 *
 * Only when the changed message is the newest one: anything older is not what
 * the preview shows. Without this an unsent message kept showing, word for
 * word, in the list under the conversation's name.
 */
async function refreshPreview(conversationId: string, changed: IMessage): Promise<void> {
  const newer = await Message.exists({ conversationId, createdAt: { $gt: changed.createdAt } });
  if (newer) return;

  const latest = await Message.findOne({ conversationId, deletedAt: null }).sort({ createdAt: -1 });
  await Conversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessagePreview: latest ? preview(latest.body, latest.attachments).slice(0, 200) : '',
        lastMessageSender: latest?.senderName ?? ''
      }
    }
  );
}

/** The caller's own message, or a 403/404 explaining which it was. */
async function ownMessage(person: Caller, conversationId: string, messageId: string): Promise<IMessage> {
  if (!Types.ObjectId.isValid(messageId)) {
    throw new NotFoundError('Message not found');
  }
  const message = await Message.findOne({ _id: messageId, conversationId });
  if (!message || message.deletedAt) {
    throw new NotFoundError('Message not found');
  }
  if (message.senderId !== person.id) {
    throw new ForbiddenError('You can only change your own messages');
  }
  return message;
}

export async function editMessage(
  person: Caller,
  conversation: IConversation,
  messageId: string,
  body: string
): Promise<MessageView> {
  const conversationId = conversation._id.toString();
  const message = await ownMessage(person, conversationId, messageId);

  const trimmed = body.trim();
  if (!trimmed && message.attachments.length === 0) {
    throw new BadRequestError('A message needs text or an attachment');
  }

  message.body = trimmed;
  message.editedAt = new Date();
  await message.save();
  await refreshPreview(conversationId, message);

  const view = (await withDownloadUrls([toView(message)]))[0]!;
  publishToGroup(conversation.groupId, {
    type: 'message.updated',
    conversationId,
    at: message.editedAt.getTime(),
    payload: view
  });
  return view;
}

/**
 * Soft-deletes. The row stays so replies keep pointing somewhere and the
 * stream's id sequence stays monotonic; the content is dropped by `toView`.
 */
export async function deleteMessage(
  person: Caller,
  conversation: IConversation,
  messageId: string
): Promise<void> {
  const conversationId = conversation._id.toString();
  const message = await ownMessage(person, conversationId, messageId);

  const attachments = [...message.attachments];
  message.deletedAt = new Date();
  await message.save();
  await refreshPreview(conversationId, message);

  // The record is soft-deleted so replies keep resolving, but the bytes are
  // not: keeping files nobody can see would charge the group's owner for
  // storage they cannot reach or free. Every file's folder, not only the
  // original's: a video's poster is uploaded under a ticket of its own and so
  // lands in a folder of its own.
  if (attachments.length > 0) {
    for (const folder of new Set(fileIdsOf(attachments).map(folderFor))) {
      await deleteFolder(folder).catch((error: Error) =>
        // The message is already gone from view. An orphaned file is a job for
        // the nightly reconciliation, not a reason to fail the delete.
        logger.warn('Could not delete chat attachment folder', { folder, error: error.message })
      );
    }
    await releaseStoredBytes(conversation.groupId, bytesOf({ attachments }));
  }

  publishToGroup(conversation.groupId, {
    type: 'message.deleted',
    conversationId,
    at: message.deletedAt.getTime(),
    payload: { id: messageId }
  });
}

/**
 * Toggles the caller's reaction. One emoji per person per message: reacting
 * again with a different emoji replaces rather than adds, which is what every
 * chat app does and what people expect.
 */
export async function toggleReaction(
  person: Caller,
  conversation: IConversation,
  messageId: string,
  emoji: string
): Promise<MessageView> {
  const conversationId = conversation._id.toString();

  if (!Types.ObjectId.isValid(messageId)) {
    throw new NotFoundError('Message not found');
  }
  const message = await Message.findOne({ _id: messageId, conversationId, deletedAt: null });
  if (!message) {
    throw new NotFoundError('Message not found');
  }

  const existing = message.reactions.find((reaction) => reaction.userId === person.id);
  if (existing && existing.emoji === emoji) {
    message.reactions = message.reactions.filter((reaction) => reaction.userId !== person.id);
  } else if (existing) {
    existing.emoji = emoji;
    existing.at = new Date();
  } else {
    message.reactions.push({ userId: person.id, name: person.name, emoji, at: new Date() });
  }
  await message.save();

  const view = (await withDownloadUrls([toView(message)]))[0]!;
  publishToGroup(conversation.groupId, {
    type: 'reaction.updated',
    conversationId,
    at: Date.now(),
    payload: view
  });
  return view;
}

/**
 * Moves this person's read cursor forward, never back. An older tab reporting
 * a stale position must not resurrect notifications the phone already cleared.
 */
export async function markRead(
  person: Caller,
  conversationId: string,
  lastReadMessageId?: string,
  at: Date = new Date()
): Promise<void> {
  await ReadState.updateOne(
    { conversationId, userId: person.id },
    {
      $max: { lastReadAt: at },
      $set: { lastReadMessageId: lastReadMessageId ?? null },
      $setOnInsert: { conversationId, userId: person.id }
    },
    { upsert: true }
  );
}

/** Announces a read cursor to the other members, so their ticks update. */
export function publishRead(conversation: IConversation, person: Caller, lastReadMessageId?: string): void {
  publishToGroup(conversation.groupId, {
    type: 'read',
    conversationId: conversation._id.toString(),
    at: Date.now(),
    payload: {
      userId: person.id,
      name: person.name,
      lastReadMessageId: lastReadMessageId ?? null,
      lastReadAt: new Date().toISOString()
    }
  });
}

/**
 * Typing is fire-and-forget: fanned out, never stored. A dropped typing event
 * costs nothing and storing them would be a write per keystroke burst.
 */
export function publishTyping(conversation: IConversation, person: Caller): void {
  publishToGroup(
    conversation.groupId,
    {
      type: 'typing',
      conversationId: conversation._id.toString(),
      at: Date.now(),
      payload: { userId: person.id, name: person.name }
    },
    // Nobody needs their own typing indicator echoed back at them.
    person.id
  );
}

/** Full-text search within the conversations the caller can reach. */
export async function searchMessages(
  conversationIds: string[],
  term: string,
  limit = 50
): Promise<MessageView[]> {
  if (conversationIds.length === 0 || !term.trim()) return [];

  try {
    const rows = await Message.find(
      { conversationId: { $in: conversationIds }, deletedAt: null, $text: { $search: term } },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(Math.min(limit, MAX_MESSAGE_PAGE_SIZE));
    return rows.map(toView);
  } catch (error) {
    // The text index is built by mongoose on boot; a search that arrives first
    // should return nothing rather than a 500.
    logger.warn('Chat search failed', { error: (error as Error).message });
    return [];
  }
}
