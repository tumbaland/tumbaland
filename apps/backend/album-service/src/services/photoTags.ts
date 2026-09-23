import mongoose from 'mongoose';
import Photo from '../models/Photo';
import Album from '../models/Album';
import { NotFoundError } from '@tumbaland/backend-core';
import { canReachAlbum, PhotoAccessContext, reachableAlbumIds } from './photoAccess';

export type TagMatch = 'any' | 'all';

export interface TagCount {
  tag: string;
  count: number;
}

export interface BulkTagInput {
  photoIds: string[];
  add?: string[];
  remove?: string[];
}

/**
 * Tags are user-typed, so the same idea arrives as "Beach", "beach " and
 * "BEACH". Trimming and case-folding on the way in keeps one bucket per idea —
 * otherwise filtering and the tag list both fragment.
 */
export const normalizeTags = (tags: string[] = []): string[] => {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = typeof tag === 'string' ? tag.trim().toLowerCase() : '';
    if (normalized.length > 0) seen.add(normalized);
  }
  return Array.from(seen);
};

/**
 * List every tag used by an album's photos, most used first.
 *
 * Feeds the filter row and the tag-input suggestions, so the person tagging
 * a photo reuses the vocabulary already in the album instead of inventing a
 * near-duplicate of it.
 */
export const getAlbumTags = async (albumId: string, context: PhotoAccessContext): Promise<TagCount[]> => {
  // Checked before the lookup so a malformed id surfaces as a 404 rather
  // than a BSON cast error out of the aggregation below.
  if (!mongoose.Types.ObjectId.isValid(albumId)) {
    throw new NotFoundError('Album not found');
  }

  const album = await Album.findById(albumId);
  if (!album || !canReachAlbum(album, context, 'read')) {
    throw new NotFoundError('Album not found');
  }

  const rows = await Photo.aggregate<{ _id: string; count: number }>([
    { $match: { albumId: new mongoose.Types.ObjectId(albumId) } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }
  ]);

  return rows.map((row) => ({ tag: row._id, count: row.count }));
};

/**
 * Add and/or remove tags across many photos at once.
 *
 * Tagging one photo at a time through `updatePhoto` is the reason albums go
 * untagged; this is what the grid's multi-select hands off to. Adds and
 * removes are applied in that order per photo, so a tag in both lists ends up
 * removed.
 */
export const bulkUpdateTags = async (
  input: BulkTagInput,
  context: PhotoAccessContext
): Promise<{ matched: number; modified: number; tags: TagCount[] }> => {
  const requested = (input.photoIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const add = normalizeTags(input.add);
  const remove = normalizeTags(input.remove);

  // Answered before any lookup: a request naming no photos, or asking for no
  // change, has nothing to check reachability for.
  if (requested.length === 0 || (add.length === 0 && remove.length === 0)) {
    return { matched: 0, modified: 0, tags: [] };
  }

  // Narrowed to photos the caller can actually reach, rather than checked
  // afterwards: an unreachable id is dropped silently, so a caller learns
  // nothing about whether it existed.
  const candidates = await Photo.find({ _id: { $in: requested } })
    .select('_id albumId')
    .lean();
  const reachable = await reachableAlbumIds(
    [...new Set(candidates.map((photo) => String(photo.albumId)))],
    context,
    'write'
  );
  const photoIds = candidates
    .filter((photo) => reachable.has(String(photo.albumId)))
    .map((photo) => String(photo._id));

  if (photoIds.length === 0) {
    return { matched: 0, modified: 0, tags: [] };
  }

  const filter = { _id: { $in: photoIds.map((id) => new mongoose.Types.ObjectId(id)) } };
  let matched = 0;
  let modified = 0;

  if (add.length > 0) {
    // $addToSet keeps the operation idempotent: re-tagging a photo that
    // already carries the tag is a no-op rather than a duplicate entry.
    const result = await Photo.updateMany(filter, { $addToSet: { tags: { $each: add } } });
    matched = result.matchedCount ?? 0;
    modified += result.modifiedCount ?? 0;
  }

  if (remove.length > 0) {
    const result = await Photo.updateMany(filter, { $pull: { tags: { $in: remove } } });
    matched = Math.max(matched, result.matchedCount ?? 0);
    modified += result.modifiedCount ?? 0;
  }

  // Hand back the album's refreshed tag list so the client can update its
  // filter row without a second round trip.
  const photo = await Photo.findById(photoIds[0]).select('albumId');
  const tags = photo ? await getAlbumTags(photo.albumId.toString(), context) : [];

  return { matched, modified, tags };
};
