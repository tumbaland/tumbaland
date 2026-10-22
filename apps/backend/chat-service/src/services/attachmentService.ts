import { randomUUID } from 'crypto';
import path from 'path';
import sharp from 'sharp';
import { BadRequestError, logger } from '@tumbaland/backend-core';
import type { IAttachment, IMessage } from '../models/Message';
import { downloadBuffer, getDownloadUrls, getUploadUrl, storedSize, uploadBuffer } from './fileServiceClient';
import type { MessageView } from './messageService';
import { isAudioType, isDocumentType } from '../validation/schemas';

/**
 * Where an attachment's files live.
 *
 * One folder per upload, under the conversation, under the group:
 *
 *   chat/<groupId>/<conversationId>/<uuid>/original.jpg
 *                                          thumb.webp
 *                                          poster.jpg
 *
 * Grouping by upload rather than by message is deliberate: the folder is
 * created when the signed URL is minted, which is before the message exists and
 * therefore before a message id does. It also means one prefix delete removes
 * the original and everything generated from it, without this service tracking
 * which of them it made.
 *
 * The group comes first so removing a whole group's chat is also one prefix.
 */
export function buildFileId(groupId: string, conversationId: string, filename: string): string {
  // Only the extension is taken from the client's filename. A name is
  // attacker-controlled and ends up as a path; `path.extname` on a basename
  // cannot produce a separator, and anything unexpected is dropped.
  const extension = path.extname(path.basename(filename)).toLowerCase().slice(0, 10);
  const safeExtension = /^\.[a-z0-9]{1,9}$/.test(extension) ? extension : '';

  return `chat/${groupId}/${conversationId}/${randomUUID()}/original${safeExtension}`;
}

/** The folder every one of a conversation's uploads lives under. */
export function conversationPrefix(groupId: string, conversationId: string): string {
  return `chat/${groupId}/${conversationId}/`;
}

/**
 * Whether a file id sits inside this conversation's folder.
 *
 * File ids arrive from the client, and the service signs download URLs for
 * them and deletes their folders on unsend. Without this check a message could
 * name any path in storage: another group's photos to read, or to delete.
 */
export function belongsToConversation(fileId: string, groupId: string, conversationId: string): boolean {
  return fileId.startsWith(conversationPrefix(groupId, conversationId)) && !fileId.includes('..');
}

/** The thumbnail beside an original, in the same folder. */
export function thumbnailFileIdFor(fileId: string): string {
  return `${path.posix.dirname(fileId)}/thumb.webp`;
}

/** Where the browser-generated video poster is expected to be put. */
export function posterFileIdFor(fileId: string): string {
  return `${path.posix.dirname(fileId)}/poster.jpg`;
}

/** The folder holding one upload's files, for a prefix delete. */
export function folderFor(fileId: string): string {
  return path.posix.dirname(fileId);
}

/** An upload URL good for at most `sizeBytes`, the size the quota was checked against. */
export async function signUpload(fileId: string, mimetype: string, sizeBytes: number): Promise<string> {
  return getUploadUrl(fileId, mimetype, 15, sizeBytes);
}

/** Longest edge of a generated thumbnail. */
const THUMBNAIL_SIZE = 640;

/**
 * Makes the display copy of an uploaded image.
 *
 * Two jobs in one pass. It keeps a full-size phone photo from being downloaded
 * whole just to fill a bubble, and it converts HEIC, which iPhones upload and
 * Chrome on Android cannot display at all. The original is kept either way, so
 * this is a display copy and never the only copy.
 *
 * Failure is not fatal: the message still sends and the client falls back to
 * the original. A thumbnail is an optimisation, and a send that fails because
 * an image could not be resized would be a much worse outcome.
 */
export async function generateThumbnail(fileId: string, mimetype: string): Promise<string | null> {
  if (!mimetype.startsWith('image/')) return null;

  try {
    const original = await downloadBuffer(fileId);
    const thumbnail = await sharp(original)
      .rotate() // Honours the EXIF orientation, then drops it with the metadata.
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const thumbnailFileId = thumbnailFileIdFor(fileId);
    await uploadBuffer(thumbnailFileId, thumbnail, 'image/webp');
    return thumbnailFileId;
  } catch (error) {
    logger.warn('Chat thumbnail generation failed; falling back to the original', {
      fileId,
      error: (error as Error).message
    });
    return null;
  }
}

/** Photos and videos, as opposed to documents and voice messages. Only these go to the album. */
export const isMedia = (attachment: Pick<IAttachment, 'mimetype'>): boolean =>
  attachment.mimetype.startsWith('image/') || attachment.mimetype.startsWith('video/');

/** What to call one attachment in a one-line summary or a notification. */
export function attachmentNoun(attachment: Pick<IAttachment, 'mimetype'>): string {
  if (isDocumentType(attachment.mimetype)) return 'Document';
  if (isAudioType(attachment.mimetype)) return 'Voice message';
  return attachment.mimetype.startsWith('video/') ? 'Video' : 'Photo';
}

/** Every file id a set of attachments refers to, originals and derivatives. */
export function fileIdsOf(attachments: IAttachment[]): string[] {
  return attachments.flatMap((attachment) =>
    [attachment.fileId, attachment.thumbnailFileId, attachment.posterFileId].filter(
      (value): value is string => Boolean(value)
    )
  );
}

/**
 * Attaches signed download URLs to a page of messages.
 *
 * One call to file-service for the whole page rather than one per attachment.
 * The URLs are short-lived, so they are minted per response rather than stored.
 */
export async function withDownloadUrls(messages: MessageView[]): Promise<MessageView[]> {
  const fileIds = messages.flatMap((message) => fileIdsOf(message.attachments));
  if (fileIds.length === 0) return messages;

  const urls = await getDownloadUrls(fileIds);

  return messages.map((message) =>
    message.attachments.length === 0
      ? message
      : {
          ...message,
          attachments: message.attachments.map((attachment) => ({
            ...attachment,
            url: urls.get(attachment.fileId) ?? null,
            thumbnailUrl: attachment.thumbnailFileId ? (urls.get(attachment.thumbnailFileId) ?? null) : null,
            posterUrl: attachment.posterFileId ? (urls.get(attachment.posterFileId) ?? null) : null
          }))
        }
  );
}

/**
 * The attachments with `sizeBytes` replaced by what file-service actually
 * holds. The client's figure is what it says it uploaded, and the storage meter
 * is charged from this, so it cannot be trusted; the stored size can.
 */
export async function withStoredSizes(attachments: IAttachment[]): Promise<IAttachment[]> {
  return Promise.all(
    attachments.map(async (attachment) => {
      const size = await storedSize(attachment.fileId);
      if (size === null) throw new BadRequestError('That upload did not finish. Try sending it again.');
      return { ...attachment, sizeBytes: size };
    })
  );
}

/** Total bytes a message's attachments occupy, for the storage meter. */
export function bytesOf(message: Pick<IMessage, 'attachments'>): number {
  return message.attachments.reduce((total, attachment) => total + (attachment.sizeBytes || 0), 0);
}
