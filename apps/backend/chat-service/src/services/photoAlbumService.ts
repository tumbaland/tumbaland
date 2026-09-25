import { BadRequestError, NotFoundError, logger } from '@tumbaland/backend-core';
import { Types } from 'mongoose';
import { Conversation, IConversation, IPhotoAlbumSetting } from '../models/Conversation';
import { IMessage, Message } from '../models/Message';
import type { Caller } from './accessService';
import * as albums from './albumClient';
import { withDownloadUrls } from './attachmentService';
import { postSystemLine, toView, type MessageView } from './messageService';
import { publishToGroup } from './streamHub';

/**
 * Chat photos and videos saved to Album.
 *
 * Each conversation has one "photos go to" album, chosen by either person and
 * kept until someone changes it. After a send, every file on the message is
 * added to that album as an entry pointing at chat's own file (album-service
 * never copies it). Unsending, or "Remove from album", takes the entries out.
 *
 * All of it runs after the message is stored and never fails a send: Album
 * being slow or down costs the album entry, not the message.
 */

export interface PhotoAlbumView {
  mode: 'unset' | 'album' | 'off';
  albumId: string | null;
  albumName: string | null;
}

export const photoAlbumView = (setting?: IPhotoAlbumSetting | null): PhotoAlbumView => ({
  mode: setting?.mode ?? 'unset',
  albumId: setting?.mode === 'album' ? (setting.albumId ?? null) : null,
  albumName: setting?.mode === 'album' ? (setting.albumName ?? null) : null
});

function announceSetting(conversation: IConversation, setting: IPhotoAlbumSetting): void {
  publishToGroup(conversation.groupId, {
    type: 'conversation.updated',
    conversationId: conversation._id.toString(),
    at: Date.now(),
    payload: { photoAlbum: photoAlbumView(setting) }
  });
}

export type PhotoAlbumChoice = { mode: 'off' } | { mode: 'album'; albumId: string } | { mode: 'album'; newAlbumName: string };

/** Changes where the conversation's photos go, for everyone in it. */
export async function setPhotoAlbum(
  person: Caller,
  conversation: IConversation,
  choice: PhotoAlbumChoice
): Promise<PhotoAlbumView> {
  // Choosing what is already chosen changes nothing: no line in the thread
  // saying it did, and nothing sent to anyone.
  const current = conversation.photoAlbum;
  const unchanged =
    (choice.mode === 'off' && current?.mode === 'off') ||
    ('albumId' in choice && current?.mode === 'album' && current.albumId === choice.albumId);
  if (unchanged) return photoAlbumView(current);

  let setting: IPhotoAlbumSetting;

  if (choice.mode === 'off') {
    setting = { mode: 'off', albumId: null, albumName: null, setById: person.id, setAt: new Date() };
  } else {
    const album =
      'newAlbumName' in choice
        ? await albums.createAlbum(conversation.groupId, person.id, choice.newAlbumName)
        : await albums.getAlbum(conversation.groupId, choice.albumId);
    // Checked against the conversation's own group, so an album id from
    // elsewhere cannot be used to write into someone else's album.
    if (!album) throw new BadRequestError('That album is not in this group');
    setting = { mode: 'album', albumId: album.id, albumName: album.name, setById: person.id, setAt: new Date() };
  }

  await Conversation.updateOne({ _id: conversation._id }, { $set: { photoAlbum: setting } });
  conversation.photoAlbum = setting;
  announceSetting(conversation, setting);

  const who = person.name || 'Someone';
  await postSystemLine(
    person,
    conversation,
    setting.mode === 'album' ? `${who} set photos to go to ${setting.albumName}` : `${who} stopped saving photos to Album`
  );

  return photoAlbumView(setting);
}

async function publishUpdated(conversation: IConversation, message: IMessage): Promise<MessageView> {
  const [view] = await withDownloadUrls([toView(message)]);
  publishToGroup(conversation.groupId, {
    type: 'message.updated',
    conversationId: conversation._id.toString(),
    at: Date.now(),
    payload: view
  });
  return view!;
}

/**
 * Adds a just-sent message's files to the conversation's album, then marks
 * them "In Rome" in the thread. Never throws.
 */
export async function saveToAlbum(conversation: IConversation, message: IMessage): Promise<void> {
  const setting = conversation.photoAlbum;
  if (setting?.mode !== 'album' || !setting.albumId || message.attachments.length === 0) return;

  try {
    for (const attachment of message.attachments) {
      const saved = await albums.addChatPhoto({
        groupId: conversation.groupId,
        albumId: setting.albumId,
        conversationId: conversation._id.toString(),
        messageId: message._id.toString(),
        fileId: attachment.fileId,
        thumbnailFileId: attachment.thumbnailFileId ?? null,
        posterFileId: attachment.posterFileId ?? null,
        mimetype: attachment.mimetype,
        size: attachment.sizeBytes,
        width: attachment.width ?? null,
        height: attachment.height ?? null,
        takenAt: message.createdAt.toISOString()
      });
      attachment.albumId = saved.albumId;
      attachment.albumName = saved.albumName;
    }

    // Unsent while this ran: its files are being deleted, so the entries must go.
    const current = await Message.findById(message._id);
    if (!current || current.deletedAt) {
      await albums.removeChatPhotos(message._id.toString());
      return;
    }

    current.attachments = message.attachments;
    current.markModified('attachments');
    await current.save();
    await publishUpdated(conversation, current);
  } catch (error) {
    if (error instanceof albums.AlbumGoneError) {
      // Deleted in Album since it was chosen. Back to asking, rather than
      // failing quietly on every photo from now on.
      const setting: IPhotoAlbumSetting = { mode: 'unset', albumId: null, albumName: null, setById: null, setAt: new Date() };
      await Conversation.updateOne({ _id: conversation._id }, { $set: { photoAlbum: setting } }).catch(() => undefined);
      announceSetting(conversation, setting);
      return;
    }
    logger.warn('Could not save chat photos to Album', {
      messageId: message._id.toString(),
      error: (error as Error).message
    });
  }
}

async function messageIn(conversation: IConversation, messageId: string): Promise<IMessage> {
  if (!Types.ObjectId.isValid(messageId)) throw new NotFoundError('Message not found');
  const message = await Message.findOne({ _id: messageId, conversationId: conversation._id.toString(), deletedAt: null });
  if (!message) throw new NotFoundError('Message not found');
  return message;
}

/** The message's files the change is about: one, when a file is named, or all of them. */
function targetsOf(message: IMessage, fileId?: string) {
  const targets = message.attachments.filter((attachment) => !fileId || attachment.fileId === fileId);
  if (targets.length === 0) throw new NotFoundError('That file is not on this message');
  return targets;
}

/**
 * Takes a message's files out of their album, from the long-press menu or one
 * photo's edit button. Anyone in the conversation may: the album is the group's.
 */
export async function removeFromAlbum(
  conversation: IConversation,
  messageId: string,
  fileId?: string
): Promise<MessageView> {
  const message = await messageIn(conversation, messageId);
  const targets = targetsOf(message, fileId);

  await albums.removeChatPhotos(messageId, fileId);

  for (const attachment of targets) {
    attachment.albumId = null;
    attachment.albumName = null;
  }
  message.markModified('attachments');
  await message.save();
  return publishUpdated(conversation, message);
}

export type AlbumPlacement = { albumId: string } | { newAlbumName: string };

/**
 * Puts a message's files, or one of them, in the chosen album: moving those
 * already in an album (so what Album added to them goes along) and adding the
 * ones that are not, such as a "Not this one" send or one taken out earlier.
 * Does not change where the conversation's new photos go.
 */
export async function placeInAlbum(
  person: Caller,
  conversation: IConversation,
  messageId: string,
  placement: AlbumPlacement,
  fileId?: string
): Promise<MessageView> {
  const message = await messageIn(conversation, messageId);
  const targets = targetsOf(message, fileId);

  const album =
    'newAlbumName' in placement
      ? await albums.createAlbum(conversation.groupId, person.id, placement.newAlbumName)
      : await albums.getAlbum(conversation.groupId, placement.albumId);
  if (!album) throw new BadRequestError('That album is not in this group');

  const saved = targets.filter((attachment) => attachment.albumId);
  if (saved.length > 0) {
    await albums.moveChatPhotos(messageId, {
      groupId: conversation.groupId,
      albumId: album.id,
      fileIds: saved.map((attachment) => attachment.fileId)
    });
  }
  for (const attachment of targets.filter((candidate) => !candidate.albumId)) {
    await albums.addChatPhoto({
      groupId: conversation.groupId,
      albumId: album.id,
      conversationId: conversation._id.toString(),
      messageId,
      fileId: attachment.fileId,
      thumbnailFileId: attachment.thumbnailFileId ?? null,
      posterFileId: attachment.posterFileId ?? null,
      mimetype: attachment.mimetype,
      size: attachment.sizeBytes,
      width: attachment.width ?? null,
      height: attachment.height ?? null,
      takenAt: message.createdAt.toISOString()
    });
  }

  for (const attachment of targets) {
    attachment.albumId = album.id;
    attachment.albumName = album.name;
  }
  message.markModified('attachments');
  await message.save();
  return publishUpdated(conversation, message);
}

/** On unsend: the files are about to be deleted, so no album may point at them. */
export async function forgetUnsent(messageId: string): Promise<void> {
  await albums.removeChatPhotos(messageId).catch((error: Error) =>
    logger.warn('Could not remove an unsent message from Album', { messageId, error: error.message })
  );
}
