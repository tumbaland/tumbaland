import Album from '../models/Album';
import { canAccessResource, NotFoundError } from '@tumbaland/backend-core';

/** Who is asking. Every by-id photo operation needs one. */
export interface PhotoAccessContext {
  userId: string;
  userGroups: string[];
}

/**
 * A photo is reachable exactly when its album is.
 *
 * Photos carry no owner of their own, so every check has to go through the
 * album. Without it, any signed-in caller could read, retitle, retag or delete
 * any other account's photo by naming its id, and `getPhotoById` answers with a
 * working signed URL to the image file itself.
 *
 * Reading and writing are different questions. A public album can be looked at
 * by anyone, but only its owner or its group may change what is in it. Using the
 * read answer for writes let any signed-in caller retag, retitle or delete the
 * photos in someone else's public album.
 */
export type PhotoAccess = 'read' | 'write';

/** Whether the caller may reach an album, for reading or for writing. */
export const canReachAlbum = (
  album: { userId: string; groupId?: string; isPublic?: boolean },
  { userId, userGroups }: PhotoAccessContext,
  access: PhotoAccess
): boolean => canAccessResource(userId, album.userId, album.groupId, userGroups, access === 'read' && !!album.isPublic);

export const reachableAlbumIds = async (
  albumIds: string[],
  context: PhotoAccessContext,
  access: PhotoAccess
): Promise<Set<string>> => {
  const albums = await Album.find({ _id: { $in: albumIds } })
    .select('_id userId groupId isPublic')
    .lean();

  return new Set(albums.filter((album) => canReachAlbum(album, context, access)).map((album) => String(album._id)));
};

/** Throws unless the caller may reach the album this photo sits in. */
export const assertPhotoReachable = async (
  albumId: unknown,
  context: PhotoAccessContext,
  access: PhotoAccess
): Promise<void> => {
  const reachable = await reachableAlbumIds([String(albumId)], context, access);
  if (!reachable.has(String(albumId))) {
    // Same message as a missing photo: distinguishing "not yours" from "not
    // there" confirms an id exists to someone guessing at them.
    throw new NotFoundError('Photo not found');
  }
};
