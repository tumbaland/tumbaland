import mongoose, { HydratedDocument } from 'mongoose';
import Photo, { IPhoto } from '../models/Photo';
import Album from '../models/Album';
import { BadRequestError, canAccessResource, ConflictError, logger, NotFoundError } from '@tumbaland/backend-core';
import {
  albumFolder,
  deleteFile,
  getPhotoSignedUrl,
  getPhotoSignedUrlsBatch,
  getFile,
  SignedUrlData,
  storedSize
} from './fileServiceClient';
import { generateThumbnailFromBuffer, isSupportedImageFormat } from './thumbnailService';

export interface CreatePhotoInput {
  filename: string;
  originalName: string;
  fileId?: string;
  minioFileId?: string;
  albumId: string;
  title?: string;
  description?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  tags?: string[];
  metadata?: IPhoto['metadata'];
}

export interface UpdatePhotoInput {
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: IPhoto['metadata'];
}

interface PhotoQuery {
  albumId: string;
  $text?: { $search: string };
  tags?: { $in: string[] } | { $all: string[] };
}

export interface PhotoWithSignedUrls {
  _id: unknown;
  filename: string;
  originalName: string;
  minioFileId?: string;
  minioThumbnailFileId?: string;
  albumId: string;
  title?: string;
  description?: string;
  mimetype: string;
  size: number;
  width?: number;
  height?: number;
  tags: string[];
  metadata: IPhoto['metadata'];
  createdAt: Date;
  updatedAt: Date;
  signedUrl?: string;
  signedUrlExpiresAt?: string;
  signedUrlExpiresInMinutes?: number;
  thumbnailSignedUrl?: string;
  thumbnailSignedUrlExpiresAt?: string;
  thumbnailSignedUrlExpiresInMinutes?: number;
}

export interface GetPhotosFilter {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  /** 'all' (default) keeps photos carrying every selected tag; 'any' widens to a union. */
  tagMatch?: TagMatch;
}

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

/** Who is asking. Every by-id operation below needs one. */
export interface PhotoAccessContext {
  userId: string;
  userGroups: string[];
}

/**
 * A photo is reachable exactly when its album is.
 *
 * Photos carry no owner of their own, so every check has to go through the
 * album, and until now none of them did: `getPhotoById`, `updatePhoto`,
 * `deletePhoto` and `bulkUpdateTags` all took an id and nothing else. Any
 * signed-in caller could read, retitle, retag or delete any other account's
 * photo by naming its id, and `getPhotoById` answers with a working signed URL
 * to the image file itself.
 */
/**
 * Reading and writing are different questions. A public album can be looked at
 * by anyone, but only its owner or its group may change what is in it. Using the
 * read answer for writes let any signed-in caller retag, retitle or delete the
 * photos in someone else's public album.
 */
type PhotoAccess = 'read' | 'write';

/** Whether the caller may reach an album, for reading or for writing. */
const canReachAlbum = (
  album: { userId: string; groupId?: string; isPublic?: boolean },
  { userId, userGroups }: PhotoAccessContext,
  access: PhotoAccess
): boolean => canAccessResource(userId, album.userId, album.groupId, userGroups, access === 'read' && !!album.isPublic);

const reachableAlbumIds = async (
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
const assertPhotoReachable = async (
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

class PhotoService {
  /**
   * Create a new photo record
   */
  async createPhoto(
    input: CreatePhotoInput,
    userId: string,
    groupId?: string,
    userGroups: string[] = []
  ): Promise<IPhoto> {
    const {
      filename,
      originalName,
      fileId,
      minioFileId,
      albumId,
      title,
      description,
      mimetype,
      width,
      height,
      tags = [],
      metadata = {}
    } = input;

    // Use minioFileId if provided, otherwise use fileId (for backward compatibility).
    // Route-level schema validation already guarantees one of them is present.
    const actualMinioFileId = (minioFileId || fileId)!;

    // The album has to exist and be one the caller may add to. Both answer the
    // same, so album ids cannot be probed.
    const album = await Album.findById(albumId);
    if (!album || !canReachAlbum(album, { userId, userGroups }, 'write')) {
      throw new NotFoundError('Album not found');
    }

    // The file has to be one uploaded for this album. The id comes from the
    // client, and a photo record is what download URLs are signed from, so an
    // id from another album would hand out someone else's photo.
    if (!actualMinioFileId.startsWith(albumFolder(albumId, userId, album.groupId ?? undefined))) {
      throw new BadRequestError('That file was not uploaded to this album');
    }

    // Charged by what is really stored, not by the size the client reports.
    const storedBytes = await storedSize(actualMinioFileId);
    if (storedBytes === null) {
      throw new BadRequestError('That upload did not finish. Try uploading it again.');
    }

    // Check if photo with this minioFileId already exists
    if (actualMinioFileId) {
      const existingPhoto = await Photo.findOne({ minioFileId: actualMinioFileId });
      if (existingPhoto) {
        throw new ConflictError('Photo with this MinIO file ID already exists');
      }
    }

    const photo = new Photo({
      filename,
      originalName,
      minioFileId: actualMinioFileId,
      albumId,
      title: title?.trim(),
      description: description?.trim(),
      mimetype,
      size: storedBytes,
      width,
      height,
      tags: normalizeTags(tags),
      metadata
    });

    const savedPhoto = await photo.save();

    // Keep the album's denormalized photoCount/totalSize in sync so listing
    // and dashboard pages can read them directly instead of aggregating
    // across every photo on each request.
    await Album.updateOne({ _id: albumId }, { $inc: { photoCount: 1, totalSize: storedBytes } });

    // Generate thumbnail asynchronously for supported image formats (don't block photo creation)
    if (isSupportedImageFormat(mimetype)) {
      this.generateThumbnailAsync(savedPhoto._id.toString(), actualMinioFileId, originalName, userId, albumId, groupId);
    }

    // If this is the first photo in the album and no cover is set, make it the cover
    if (!album.coverPhotoId) {
      album.coverPhotoId = savedPhoto._id.toString();
      await album.save();
    }

    return savedPhoto;
  }

  /**
   * Get photos by album with pagination and optional search
   */
  async getPhotosByAlbum(
    albumId: string,
    filter: GetPhotosFilter,
    context: PhotoAccessContext
  ): Promise<{
    photos: PhotoWithSignedUrls[];
    pagination: {
      page: number;
      limit?: number;
      total: number;
      pages: number;
    };
  }> {
    const { page = 1, limit, search, tags, tagMatch = 'all' } = filter;

    // Every photo in the page leaves with a signed URL, so an album the caller
    // cannot reach answers as missing rather than as someone else's pictures.
    const album = await Album.findById(albumId);
    if (!album || !canReachAlbum(album, context, 'read')) {
      throw new NotFoundError('Album not found');
    }

    const query: PhotoQuery = { albumId };
    if (search) {
      query.$text = { $search: search };
    }

    const selectedTags = normalizeTags(tags);
    if (selectedTags.length > 0) {
      // 'all' narrows with each tag the user adds, which is what a filter chip
      // row reads like; 'any' is there for "show me either of these".
      query.tags = tagMatch === 'any' ? { $in: selectedTags } : { $all: selectedTags };
    }

    // Handle pagination - if limit is not provided or is 0, fetch all photos
    const limitNum = limit ? Number(limit) : undefined;
    const pageNum = Number(page);

    let photosQuery = Photo.find(query).sort({ createdAt: -1 });

    if (limitNum && limitNum > 0) {
      photosQuery = photosQuery.limit(limitNum).skip((pageNum - 1) * limitNum);
    }

    const [photos, total] = await Promise.all([photosQuery, Photo.countDocuments(query)]);

    const photosWithUrls = await this.attachSignedUrls(photos);

    return {
      photos: photosWithUrls,
      pagination: {
        page: pageNum,
        limit: limitNum || 0,
        total,
        pages: limitNum && limitNum > 0 ? Math.ceil(total / limitNum) : 1
      }
    };
  }

  /**
   * Get single photo by ID
   */
  async getPhotoById(photoId: string, context: PhotoAccessContext): Promise<PhotoWithSignedUrls> {
    const photo = await Photo.findById(photoId).populate('albumId');

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    // Before enriching: the enrichment is what mints the signed URL, and that
    // is the thing worth not handing to a stranger.
    const albumId = (photo.albumId as unknown as { _id?: unknown })?._id ?? photo.albumId;
    await assertPhotoReachable(albumId, context, 'read');

    return this.enrichPhotoWithSignedUrl(photo);
  }

  /**
   * Get photo by file ID (used for public/file-service lookups)
   */
  async getPhotoByFileId(fileId: string): Promise<IPhoto> {
    const photo = await Photo.findOne({ minioFileId: fileId }).populate('albumId');

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    return photo;
  }

  /**
   * Update photo metadata
   */
  async updatePhoto(photoId: string, input: UpdatePhotoInput, context: PhotoAccessContext): Promise<IPhoto | null> {
    const photo = await Photo.findById(photoId);
    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    await assertPhotoReachable(photo.albumId, context, 'write');

    const updateData: Partial<Pick<IPhoto, 'title' | 'description' | 'tags' | 'metadata'>> = {};
    if (input.title !== undefined) updateData.title = input.title?.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim();
    if (input.tags) {
      updateData.tags = normalizeTags(input.tags);
    }
    if (input.metadata) updateData.metadata = input.metadata;

    return Photo.findByIdAndUpdate(photoId, updateData, { new: true });
  }

  /**
   * List every tag used by an album's photos, most used first.
   *
   * Feeds the filter row and the tag-input suggestions, so the person tagging
   * a photo reuses the vocabulary already in the album instead of inventing a
   * near-duplicate of it.
   */
  async getAlbumTags(albumId: string, context: PhotoAccessContext): Promise<TagCount[]> {
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
  }

  /**
   * Add and/or remove tags across many photos at once.
   *
   * Tagging one photo at a time through `updatePhoto` is the reason albums go
   * untagged; this is what the grid's multi-select hands off to. Adds and
   * removes are applied in that order per photo, so a tag in both lists ends up
   * removed.
   */
  async bulkUpdateTags(
    input: BulkTagInput,
    context: PhotoAccessContext
  ): Promise<{ matched: number; modified: number; tags: TagCount[] }> {
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
    const tags = photo ? await this.getAlbumTags(photo.albumId.toString(), context) : [];

    return { matched, modified, tags };
  }

  /**
   * Delete photo and associated files.
   *
   * Returns the deleted document so the caller can hand its bytes back to the
   * storage meter (MONETIZATION.md Phase 3, chokepoint 1) without re-reading a
   * row that no longer exists.
   */
  async deletePhoto(photoId: string, context: PhotoAccessContext): Promise<IPhoto> {
    const photo = await Photo.findById(photoId);
    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    await assertPhotoReachable(photo.albumId, context, 'write');

    // A photo from chat only points at chat's files; they stay for the chat.
    if (!photo.source) {
      try {
        if (photo.minioFileId) {
          await deleteFile(photo.minioFileId);
        }
        if (photo.minioThumbnailFileId) {
          await deleteFile(photo.minioThumbnailFileId);
        }
      } catch (error) {
        logger.error('Failed to delete files for photo', { photoId, error: (error as Error)?.message });
      }
    }

    // Delete the photo record
    await Photo.findByIdAndDelete(photoId);

    // Keep the album's denormalized photoCount/totalSize in sync (see createPhoto).
    await Album.updateOne({ _id: photo.albumId }, { $inc: { photoCount: -1, totalSize: -photo.size } });

    // If this was the cover photo, remove it from the album
    const album = await Album.findOne({ coverPhotoId: photoId });
    if (album) {
      album.coverPhotoId = undefined;
      await album.save();
    }

    return photo;
  }

  /**
   * Private helper: Generate thumbnail asynchronously
   */
  private generateThumbnailAsync(
    photoId: string,
    minioFileId: string,
    originalName: string,
    userId: string,
    albumId: string,
    groupId?: string
  ): void {
    setImmediate(async () => {
      try {
        // Download the original file from MinIO
        const imageBuffer = await getFile(minioFileId);

        // Generate thumbnail from the buffer
        const thumbnailResult = await generateThumbnailFromBuffer(imageBuffer, originalName, userId, albumId, groupId);

        // Update photo with thumbnail file ID returned from generation
        await Photo.findByIdAndUpdate(photoId, {
          minioThumbnailFileId: thumbnailResult.thumbnailFileId
        });

        logger.info('Thumbnail generated successfully', { photoId });
      } catch (error) {
        logger.error('Failed to generate thumbnail', { error: (error as Error)?.message });
      }
    });
  }

  /**
   * Attach original + thumbnail signed URLs to a set of photos, in two batch
   * calls rather than one round trip per photo. Shared by every listing that
   * hands photos to a client — an album page, a memories strip — so they all
   * get the same URL shape and the same "a URL failure degrades, never fails
   * the request" behaviour.
   */
  async attachSignedUrls(photos: HydratedDocument<IPhoto>[]): Promise<PhotoWithSignedUrls[]> {
    if (photos.length === 0) return [];

    let signedUrlMap: Record<string, SignedUrlData> = {};
    try {
      signedUrlMap = await getPhotoSignedUrlsBatch(photos, false, 60);
    } catch (error) {
      logger.error('Failed to fetch batch signed URLs for photos', { error: (error as Error)?.message });
    }

    // Only photos that actually have a thumbnail are worth a second batch call.
    const photosWithThumbnails = photos.filter((photo) => photo.minioThumbnailFileId);
    let thumbnailSignedUrlMap: Record<string, SignedUrlData> = {};

    if (photosWithThumbnails.length > 0) {
      try {
        thumbnailSignedUrlMap = await getPhotoSignedUrlsBatch(photosWithThumbnails, true, 60);
      } catch (error) {
        logger.error('Failed to fetch batch signed URLs for thumbnails', { error: (error as Error)?.message });
      }
    }

    return photos.map((photo) => this.enrichPhotoWithUrls(photo, signedUrlMap, thumbnailSignedUrlMap));
  }

  /**
   * Private helper: Enrich photo with signed URL
   */
  private async enrichPhotoWithSignedUrl(photo: HydratedDocument<IPhoto>): Promise<PhotoWithSignedUrls> {
    try {
      const signedUrlData = await getPhotoSignedUrl(photo, false, 60);
      const result: PhotoWithSignedUrls = {
        ...photo.toObject()
      };

      if (signedUrlData) {
        result.signedUrl = signedUrlData.signedUrl;
        result.signedUrlExpiresAt = signedUrlData.expiresAt;
        result.signedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
      }

      // Add thumbnail URL if available
      if (photo.minioThumbnailFileId) {
        try {
          const thumbnailSignedUrlData = await getPhotoSignedUrl(photo, true, 60);
          if (thumbnailSignedUrlData) {
            result.thumbnailSignedUrl = thumbnailSignedUrlData.signedUrl;
            result.thumbnailSignedUrlExpiresAt = thumbnailSignedUrlData.expiresAt;
            result.thumbnailSignedUrlExpiresInMinutes = thumbnailSignedUrlData.expiresInMinutes;
          }
        } catch (error) {
          logger.error('Failed to get thumbnail signed URL', { error: (error as Error)?.message });
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to get signed URL', { error: (error as Error)?.message });
      return photo.toObject();
    }
  }

  /**
   * Private helper: Enrich photo with URLs from maps
   */
  private enrichPhotoWithUrls(
    photo: HydratedDocument<IPhoto>,
    signedUrlMap: Record<string, SignedUrlData>,
    thumbnailSignedUrlMap: Record<string, SignedUrlData>
  ): PhotoWithSignedUrls {
    const signedUrlData = signedUrlMap[photo.minioFileId || ''];
    const photoObj = photo.toObject();

    const result: PhotoWithSignedUrls = { ...photoObj };

    if (signedUrlData) {
      result.signedUrl = signedUrlData.signedUrl;
      result.signedUrlExpiresAt = signedUrlData.expiresAt;
      result.signedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
    }

    // For photos with minioThumbnailFileId, try to get thumbnail signed URL
    if (photo.minioThumbnailFileId) {
      const thumbnailSignedUrlData = thumbnailSignedUrlMap[photo.minioFileId || ''];
      if (thumbnailSignedUrlData) {
        result.thumbnailSignedUrl = thumbnailSignedUrlData.signedUrl;
        result.thumbnailSignedUrlExpiresAt = thumbnailSignedUrlData.expiresAt;
        result.thumbnailSignedUrlExpiresInMinutes = thumbnailSignedUrlData.expiresInMinutes;
      }
    } else {
      // For photos without thumbnails (GIFs, videos), use original as thumbnail
      if (signedUrlData) {
        result.thumbnailSignedUrl = signedUrlData.signedUrl;
        result.thumbnailSignedUrlExpiresAt = signedUrlData.expiresAt;
        result.thumbnailSignedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
      }
    }

    // Explicitly include thumbnail photo IDs for frontend
    result.minioThumbnailFileId = photo.minioThumbnailFileId;

    return result;
  }
}

export default new PhotoService();
