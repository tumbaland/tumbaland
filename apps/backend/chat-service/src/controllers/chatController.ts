import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import { caller, requireConversation, requireGroupMembership } from '../services/accessService';
import * as conversations from '../services/conversationService';
import * as messages from '../services/messageService';
import { isPushConfigured, removeSubscription, saveSubscription } from '../services/pushService';
import { buildFileId, generateThumbnail, posterFileIdFor, signUpload } from '../services/attachmentService';
import { assertHeadroom } from '../services/storageUsage';
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from '../validation/schemas';
import { BadRequestError } from '@tumbaland/backend-core';

export const listConversations = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  sendSuccess(res, await conversations.listConversations(person));
};

export const createConversation = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const { groupId, title } = req.body as { groupId: string; title?: string };

  // The group comes from the body, so it is checked against the caller's own
  // membership rather than taken on trust.
  requireGroupMembership(person, groupId);

  const conversation = await conversations.ensureConversation(person, groupId, title);
  sendSuccess(
    res,
    {
      id: conversation._id.toString(),
      groupId: conversation.groupId,
      title: conversation.title ?? '',
      members: conversation.members,
      createdAt: conversation.createdAt
    },
    undefined,
    201
  );
};

/**
 * The caller's conversations, creating any that do not exist yet.
 *
 * What the app opens with. A POST rather than a GET because it may create, and
 * it returns the same shape the list does so the client needs one round trip
 * rather than two.
 */
export const ensureMyConversations = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  sendSuccess(res, await conversations.ensureConversationsForCaller(person));
};

/** One conversation with its members and read positions, for the thread page. */
export const getConversation = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  sendSuccess(res, await conversations.conversationDetail(person, conversation));
};

export const unreadCount = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  sendSuccess(res, { unread: await conversations.unreadTotal(person) });
};

export const listMessages = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);

  const page = await messages.listMessages(conversation._id.toString(), {
    before: req.query.before as string | undefined,
    after: req.query.after as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined
  });

  sendSuccess(res, page);
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);

  const { message, created } = await messages.sendMessage(person, conversation, req.body);

  // A retry answers 200 with the message that was already stored. 201 would
  // claim a second message exists; an error would tell the user a delivered
  // message failed.
  sendSuccess(res, message, undefined, created ? 201 : 200);
};

export const editMessage = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  const { body } = req.body as { body: string };

  sendSuccess(res, await messages.editMessage(person, conversation, req.params.messageId as string, body));
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);

  await messages.deleteMessage(person, conversation, req.params.messageId as string);
  res.status(204).send();
};

export const toggleReaction = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  const { emoji } = req.body as { emoji: string };

  sendSuccess(res, await messages.toggleReaction(person, conversation, req.params.messageId as string, emoji));
};

export const markRead = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  const { lastReadMessageId } = req.body as { lastReadMessageId?: string };

  await messages.markRead(person, conversation._id.toString(), lastReadMessageId);
  messages.publishRead(conversation, person, lastReadMessageId);
  res.status(204).send();
};

export const typing = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);

  messages.publishTyping(conversation, person);
  res.status(204).send();
};

export const search = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const term = (req.query.q as string | undefined) ?? '';
  const scoped = req.query.conversationId as string | undefined;

  // Searching is scoped to what the caller can already read, resolved the same
  // way the conversation list is, so a `conversationId` in the query cannot
  // widen it.
  const reachable = await conversations.listConversations(person);
  const ids = reachable
    .map((conversation) => conversation.id)
    .filter((id) => !scoped || id === scoped);

  sendSuccess(res, await messages.searchMessages(ids, term));
};

/**
 * Registers this browser for Web Push.
 *
 * Called on every app start, not only when permission is first granted: an
 * endpoint can be rotated by the push service at any time, and re-registering
 * is how a rotation is noticed. It also refreshes `lastSeenAt` and forgives
 * past delivery failures.
 */
export const subscribePush = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const { endpoint, keys, platform } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    platform?: string;
  };

  await saveSubscription(person.id, { endpoint, keys, platform }, req.header('user-agent'));
  // Reported back so the client can tell "registered" from "registered, but
  // this deployment has no VAPID keys so nothing will ever arrive".
  sendSuccess(res, { configured: isPushConfigured() }, undefined, 201);
};

export const unsubscribePush = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const { endpoint } = req.body as { endpoint: string };

  await removeSubscription(person.id, endpoint);
  res.status(204).send();
};

/**
 * A signed URL the browser uploads an attachment to directly.
 *
 * This is the storage chokepoint. It is the only point where a file's size is
 * known *before* its bytes are written: gating the message instead would mean
 * refusing to record an object that is already in storage.
 *
 * The bytes never pass through this service. The browser PUTs to file-service
 * with the signed URL and then sends the message carrying the returned fileId.
 */
export const attachmentUploadUrl = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  const { filename, mimetype, sizeBytes } = req.body as {
    filename: string;
    mimetype: string;
    sizeBytes: number;
  };

  // Per-file ceilings, checked server side. The schema's allowlist already
  // rejects anything that is not an image or a video.
  const limit = mimetype.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (sizeBytes > limit) {
    throw new BadRequestError(
      `That file is too large. The limit is ${Math.floor(limit / (1024 * 1024))} MB.`
    );
  }

  // Throws 402 when it does not fit, billed to the group's owner.
  await assertHeadroom(person, conversation.groupId, sizeBytes);

  const fileId = buildFileId(conversation.groupId, conversation._id.toString(), filename);
  const uploadUrl = await signUpload(fileId, mimetype);

  sendSuccess(
    res,
    {
      uploadUrl,
      fileId,
      // Where the browser should PUT a video's poster frame, if it made one.
      // Generating it client side keeps ffmpeg out of this service's image.
      posterUploadFileId: mimetype.startsWith('video/') ? posterFileIdFor(fileId) : null,
      expiresInMinutes: 15
    },
    undefined,
    201
  );
};

/**
 * Makes the display copy of an uploaded image: a resized webp, which also
 * converts the HEIC an iPhone uploads and Chrome on Android cannot render.
 *
 * Called by the browser after the upload lands and before the message is sent,
 * so the message can carry the thumbnail's id. A failure is reported as a null
 * id rather than an error: the client falls back to the original, and a send
 * must never fail because an image could not be resized.
 */
export const attachmentThumbnail = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);
  const conversation = await requireConversation(person, req.params.id as string);
  const { fileId, mimetype } = req.body as { fileId: string; mimetype: string };

  // The file has to be inside this conversation's folder, or this route would
  // read and rewrite any path in storage.
  const prefix = `chat/${conversation.groupId}/${conversation._id.toString()}/`;
  if (!fileId.startsWith(prefix) || fileId.includes('..')) {
    throw new BadRequestError('That file does not belong to this conversation');
  }

  sendSuccess(res, { thumbnailFileId: await generateThumbnail(fileId, mimetype) });
};
