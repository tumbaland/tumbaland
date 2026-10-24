import path from 'path';
import { Types } from 'mongoose';
import { NotFoundError } from '@tumbaland/backend-core';
import Album from '../models/Album';
import Photo from '../models/Photo';
import { announceAlbumPhotos } from '../collage/albumPhotosLive';

/**
 * What chat-service needs from Album, and nothing more.
 *
 * Chat photos are not uploaded here. Chat already stored the file, so an album
 * entry for it only points at that file: one copy of the bytes, metered once,
 * by chat. That is why nothing here records storage, and why removing such an
 * entry (here or through Album's own pages) never deletes a file.
 *
 * Every call is scoped to a group. The group is the chat conversation's, which
 * chat-service has already checked the caller belongs to.
 */

export interface AlbumOption {
  id: string;
  name: string;
  photoCount: number;
}

const isId = (value: string) => Types.ObjectId.isValid(value);

/** The group's albums, most recently changed first, for chat's album picker. */
export async function listGroupAlbums(groupId: string): Promise<AlbumOption[]> {
  const albums = await Album.find({ groupId }).sort({ updatedAt: -1 }).limit(200);
  return albums.map((album) => ({ id: album._id.toString(), name: album.name, photoCount: album.photoCount ?? 0 }));
}

/** One of the group's albums, or null when it is gone or belongs elsewhere. */
export async function getGroupAlbum(groupId: string, albumId: string): Promise<AlbumOption | null> {
  if (!isId(albumId)) return null;
  const album = await Album.findOne({ _id: albumId, groupId });
  return album ? { id: album._id.toString(), name: album.name, photoCount: album.photoCount ?? 0 } : null;
}

/** "New album…" from chat's picker: a group album like any other. */
export async function createGroupAlbum(groupId: string, userId: string, name: string): Promise<AlbumOption> {
  const album = await Album.create({ name: name.trim(), groupId, userId, isPublic: false, tags: [] });
  return { id: album._id.toString(), name: album.name, photoCount: 0 };
}

export interface ChatPhotoInput {
  groupId: string;
  albumId: string;
  conversationId: string;
  messageId: string;
  fileId: string;
  /** Chat's display copy of an image. Left out for a video: Album plays a video's own first frame. */
  thumbnailFileId?: string | null;
  /** Chat's still of a video, for places that need a picture rather than a player. */
  posterFileId?: string | null;
  mimetype: string;
  size: number;
  width?: number | null;
  height?: number | null;
  /** When it was sent, which is the best date chat has: it strips the camera's. */
  takenAt: string;
}

export interface ChatPhotoResult {
  photoId: string;
  albumId: string;
  albumName: string;
}

/**
 * Adds a chat file to an album. Idempotent on the file: a retry after a
 * dropped response returns the entry already made rather than a second one.
 */
export async function addChatPhoto(input: ChatPhotoInput): Promise<ChatPhotoResult> {
  const album = isId(input.albumId) ? await Album.findOne({ _id: input.albumId, groupId: input.groupId }) : null;
  if (!album) throw new NotFoundError('Album not found');

  const existing = await Photo.findOne({ minioFileId: input.fileId });
  if (existing) {
    const home = await Album.findById(existing.albumId);
    return { photoId: existing._id.toString(), albumId: String(existing.albumId), albumName: home?.name ?? album.name };
  }

  const video = input.mimetype.startsWith('video/');
  const photo = await Photo.create({
    filename: path.posix.basename(input.fileId),
    originalName: video ? 'Video from chat' : 'Photo from chat',
    minioFileId: input.fileId,
    // Album's grid plays a video's thumbnail link as a video, so a still
    // image there would show as broken. Images get chat's 640px copy.
    minioThumbnailFileId: video ? undefined : input.thumbnailFileId || undefined,
    minioPosterFileId: video ? input.posterFileId || undefined : undefined,
    albumId: album._id.toString(),
    mimetype: input.mimetype,
    size: input.size,
    width: input.width ?? undefined,
    height: input.height ?? undefined,
    tags: [],
    metadata: { dateTaken: new Date(input.takenAt) },
    source: { kind: 'chat', conversationId: input.conversationId, messageId: input.messageId }
  });

  // Counted, but not sized: the bytes are chat's (see the note at the top).
  await Album.updateOne({ _id: album._id }, { $inc: { photoCount: 1 } });
  if (!album.coverPhotoId) {
    // Guarded on the cover still being empty: two sends at once set it once.
    await Album.updateOne({ _id: album._id, coverPhotoId: null }, { $set: { coverPhotoId: photo._id.toString() } });
  }
  void announceAlbumPhotos([album._id.toString()]);

  return { photoId: photo._id.toString(), albumId: album._id.toString(), albumName: album.name };
}

/**
 * Moves a chat message's entries into another of the group's albums: all of
 * them, or only the files named. Moved, not re-added, so a title or tags given
 * in Album go with it.
 */
export async function moveChatPhotos(input: {
  groupId: string;
  messageId: string;
  albumId: string;
  fileIds?: string[];
}): Promise<{ moved: number; albumId: string; albumName: string }> {
  const album = isId(input.albumId) ? await Album.findOne({ _id: input.albumId, groupId: input.groupId }) : null;
  if (!album) throw new NotFoundError('Album not found');
  const target = album._id.toString();

  const photos = await Photo.find({
    'source.messageId': input.messageId,
    ...(input.fileIds?.length ? { minioFileId: { $in: input.fileIds } } : {})
  });

  // Photos already in the target stay where they are.
  const movable = photos.filter((photo) => String(photo.albumId) !== target);
  const moved = movable.length;
  const touched = new Set<string>([target]);
  if (moved > 0) {
    const ids = movable.map((photo) => photo._id.toString());
    const leaving = new Map<string, string[]>();
    for (const photo of movable) {
      const from = String(photo.albumId);
      touched.add(from);
      leaving.set(from, [...(leaving.get(from) ?? []), photo._id.toString()]);
    }

    await Photo.updateMany({ _id: { $in: ids } }, { $set: { albumId: target } });
    await Album.bulkWrite([
      // Each album they left loses them, and its cover if it was one of them.
      ...[...leaving].flatMap(([from, left]) => [
        { updateOne: { filter: { _id: from }, update: { $inc: { photoCount: -left.length } } } },
        { updateOne: { filter: { _id: from, coverPhotoId: { $in: left } }, update: { $unset: { coverPhotoId: 1 } } } }
      ]),
      { updateOne: { filter: { _id: target }, update: { $inc: { photoCount: moved } } } },
      // An album with no cover takes the first photo that arrived as its cover.
      { updateOne: { filter: { _id: target, coverPhotoId: null }, update: { $set: { coverPhotoId: ids[0] } } } }
    ]);
  }
  if (moved > 0) void announceAlbumPhotos([...touched]);

  return { moved, albumId: target, albumName: album.name };
}

/**
 * Takes a chat message's photos out of their albums: on unsend, or "Remove
 * from album". One file, or every file on the message. Never deletes a file.
 */
export async function removeChatPhotos(messageId: string, fileId?: string): Promise<number> {
  const photos = await Photo.find({ 'source.messageId': messageId, ...(fileId ? { minioFileId: fileId } : {}) });

  if (photos.length > 0) {
    const ids = photos.map((photo) => photo._id.toString());
    const perAlbum = new Map<string, number>();
    for (const photo of photos) perAlbum.set(String(photo.albumId), (perAlbum.get(String(photo.albumId)) ?? 0) + 1);

    await Photo.deleteMany({ _id: { $in: ids } });
    await Album.bulkWrite([
      ...[...perAlbum].map(([albumId, count]) => ({
        updateOne: { filter: { _id: albumId }, update: { $inc: { photoCount: -count } } }
      })),
      { updateMany: { filter: { coverPhotoId: { $in: ids } }, update: { $unset: { coverPhotoId: 1 } } } }
    ]);
  }
  if (photos.length > 0) void announceAlbumPhotos([...new Set(photos.map((photo) => String(photo.albumId)))]);
  return photos.length;
}
