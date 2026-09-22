import Album, { IAlbum } from '../models/Album';
import Photo from '../models/Photo';
import mongoose, { PipelineStage } from 'mongoose';
import { canAccessResource, ForbiddenError, logger, NotFoundError } from '@tumbaland/backend-core';
import { deleteFile, getPhotoSignedUrl, getPhotoSignedUrlsBatch, SignedUrlData } from './fileServiceClient';

interface AlbumMatchQuery {
  $text?: { $search: string };
  isPublic?: boolean;
  groupId?: string | { $exists: false };
  userId?: string;
}

interface AlbumAggRow {
  _id: unknown;
  name: string;
  description?: string;
  coverPhotoId?: string;
  isPublic: boolean;
  tags: string[];
  userId: string;
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
  photoCount: number;
  totalSize: number;
}

interface AlbumByIdAggRow extends AlbumAggRow {
  coverPhotoDoc?: PhotoDocLike;
}

interface PhotoDocLike {
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
  createdAt: Date;
  updatedAt: Date;
}

interface PhotoWithSignedUrls extends PhotoDocLike {
  signedUrl?: string | null;
  signedUrlExpiresAt?: string | null;
  signedUrlExpiresInMinutes?: number | null;
  thumbnailSignedUrl?: string | null;
  thumbnailSignedUrlExpiresAt?: string | null;
  thumbnailSignedUrlExpiresInMinutes?: number | null;
}

interface AlbumWithCoverPhoto extends AlbumAggRow {
  coverPhoto: PhotoWithSignedUrls | null;
}

export interface CreateAlbumInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  groupId?: string;
}

export interface UpdateAlbumInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  coverPhotoId?: string;
  groupId?: string;
}

export interface GetAlbumsFilter {
  page?: number;
  limit?: number;
  search?: string;
  isPublic?: boolean;
  groupId?: string;
  includeCover?: boolean;
}

export interface AlbumPermissionContext {
  userId: string;
  userGroups: string[];
  groupServiceError?: boolean;
}

/** An album's stored bytes and the scope that decides whose meter holds them. */
export interface AlbumStorage {
  userId: string;
  groupId?: string;
  bytes: number;
}

class AlbumService {
  /**
   * Create a new album with validation
   */
  async createAlbum(input: CreateAlbumInput, userId: string): Promise<IAlbum> {
    const { name, description, isPublic = false, tags = [], groupId } = input;

    const album = new Album({
      name: name.trim(),
      description: description?.trim(),
      isPublic,
      tags: tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0),
      userId,
      groupId: groupId || undefined
    });

    return album.save();
  }

  /**
   * Get albums with filtering, pagination, and optional cover photos
   */
  async getAlbums(
    filter: GetAlbumsFilter,
    context: AlbumPermissionContext
  ): Promise<{
    albums: AlbumWithCoverPhoto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const { page = 1, limit = 10, search, isPublic, groupId, includeCover = true } = filter;
    const { userId, userGroups, groupServiceError } = context;

    const matchQuery: AlbumMatchQuery = {};

    // Build base query
    if (search) {
      matchQuery.$text = { $search: search };
    }
    if (isPublic !== undefined) {
      matchQuery.isPublic = isPublic;
    }

    // Apply permission filtering
    if (groupId) {
      // If groupId is specified, filter by group (user must be member)
      if (!userGroups.includes(groupId)) {
        if (groupServiceError) {
          // Upstream group-service is down — a genuine 500, not a client error.
          throw new Error('Group service temporarily unavailable. Please try again.');
        }
        throw new ForbiddenError('Access denied: Not a member of this group');
      }
      matchQuery.groupId = groupId;
    } else {
      // No groupId specified: show only personal albums (no group)
      matchQuery.userId = userId;
      matchQuery.groupId = { $exists: false };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // photoCount/totalSize are denormalized onto the album document itself
    // (see photoService's create/deletePhoto), so listing albums is a plain
    // find — no per-page join across the photos collection needed.
    //
    // .lean() returns the raw driver document, not a hydrated Mongoose
    // document, so it does NOT apply the schema's `default: 0` — an album
    // that predates these fields (i.e. hasn't been backfilled by
    // scripts/migration/backfill-album-storage.js) comes back with
    // photoCount/totalSize simply absent, not 0. Coalesce explicitly so a
    // not-yet-backfilled album renders as "0 photos" rather than
    // "undefined photos".
    const [albumsResult, total] = await Promise.all([
      Album.find(matchQuery)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean<AlbumAggRow[]>()
        .then((rows) =>
          rows.map((row) => ({ ...row, photoCount: row.photoCount ?? 0, totalSize: row.totalSize ?? 0 }))
        ),
      Album.countDocuments(matchQuery)
    ]);

    let albumsWithCovers: AlbumWithCoverPhoto[];

    if (includeCover) {
      albumsWithCovers = await this.enrichAlbumsWithCoverPhotos(albumsResult);
    } else {
      albumsWithCovers = albumsResult.map((album) => ({
        ...album,
        coverPhoto: null
      }));
    }

    return {
      albums: albumsWithCovers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    };
  }

  /**
   * Get album by ID with photo count and cover photo
   */
  async getAlbumById(albumId: string, context: AlbumPermissionContext): Promise<AlbumWithCoverPhoto> {
    const { userId, userGroups } = context;

    // Album's own photoCount/totalSize are already denormalized (see
    // photoService's create/deletePhoto), so this pipeline only needs to
    // resolve the cover photo — no more pulling every photo in the album
    // into the pipeline just to count and filter them in memory.
    //
    // $ifNull covers an album that predates these fields (i.e. hasn't been
    // backfilled by scripts/migration/backfill-album-storage.js yet) —
    // aggregation output reflects exactly what's stored, so a missing field
    // would otherwise come back as absent/undefined rather than 0.
    const aggregationPipeline: PipelineStage[] = [
      { $match: { _id: new mongoose.Types.ObjectId(albumId as string) } },
      {
        $lookup: {
          from: 'photos',
          let: { coverPhotoId: '$coverPhotoId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$coverPhotoId'] } } }],
          as: 'coverPhotoDocs'
        }
      },
      {
        $addFields: {
          coverPhotoDoc: { $arrayElemAt: ['$coverPhotoDocs', 0] },
          photoCount: { $ifNull: ['$photoCount', 0] },
          totalSize: { $ifNull: ['$totalSize', 0] }
        }
      },
      {
        $project: {
          coverPhotoDocs: 0
        }
      }
    ];

    const albumResult = await Album.aggregate<AlbumByIdAggRow>(aggregationPipeline);

    if (!albumResult || albumResult.length === 0) {
      throw new NotFoundError('Album not found');
    }

    const albumData = albumResult[0];

    // Check if user can access this album
    const hasAccess = canAccessResource(userId, albumData.userId, albumData.groupId, userGroups, albumData.isPublic);

    if (!hasAccess && !albumData.isPublic) {
      throw new ForbiddenError('Access denied');
    }

    // Process cover photo signed URL if exists
    let coverPhoto: PhotoWithSignedUrls | null = null;
    if (albumData.coverPhotoDoc) {
      coverPhoto = await this.enrichPhotoWithSignedUrls(albumData.coverPhotoDoc);
    }

    // Remove the coverPhotoDoc field and add coverPhoto
    const { coverPhotoDoc: _coverPhotoDoc, ...albumResponse } = albumData;

    return {
      ...albumResponse,
      coverPhoto
    };
  }

  /**
   * Update album
   */
  async updateAlbum(albumId: string, input: UpdateAlbumInput, context: AlbumPermissionContext): Promise<IAlbum | null> {
    const { userId, userGroups } = context;

    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    // Public makes an album readable by anyone, never writable. Passing the flag
    // here let any signed-in caller rename, re-group or un-publish someone
    // else's public album.
    const hasAccess = canAccessResource(userId, album.userId, album.groupId, userGroups);

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    // Moving it into a group is writing into that group, and bills its storage
    // to that group's owner.
    if (input.groupId && !userGroups.includes(input.groupId)) {
      throw new ForbiddenError('Access denied');
    }

    const updateData: Partial<Pick<IAlbum, 'name' | 'description' | 'isPublic' | 'tags' | 'coverPhotoId' | 'groupId'>> =
      {};
    if (input.name) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim();
    if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;
    if (input.tags) {
      updateData.tags = input.tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
    }
    if (input.coverPhotoId !== undefined) updateData.coverPhotoId = input.coverPhotoId;
    if (input.groupId !== undefined) updateData.groupId = input.groupId;

    return Album.findByIdAndUpdate(albumId, updateData, { new: true });
  }

  /**
   * What an album's stored bytes are, and whose meter they belong to.
   *
   * Summed from the photos rather than read off `Album.totalSize`: that counter
   * is denormalized and can drift, and the nightly reconciliation deliberately
   * meters the photo sum instead, so anything that moves bytes between meters
   * has to agree with it or the two will fight.
   */
  async getAlbumStorage(albumId: string): Promise<AlbumStorage | null> {
    const album = await Album.findById(albumId);
    if (!album) return null;

    const [totals] = await Photo.aggregate<{ bytes: number }>([
      { $match: { albumId } },
      { $group: { _id: null, bytes: { $sum: '$size' } } }
    ]);

    return { userId: album.userId, groupId: album.groupId, bytes: totals?.bytes ?? 0 };
  }

  /**
   * Delete album and all associated photos and files.
   *
   * Reports the bytes it freed so the caller can hand them back to the storage
   * meter (MONETIZATION.md Phase 3, chokepoint 1).
   */
  async deleteAlbum(albumId: string, context: AlbumPermissionContext): Promise<AlbumStorage> {
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    // The only by-id album operation that took no context. Deleting an album
    // deletes every photo file in it, which makes it the one where getting this
    // wrong is least recoverable.
    if (!canAccessResource(context.userId, album.userId, album.groupId, context.userGroups)) {
      throw new ForbiddenError('Access denied');
    }

    // Get all photos in the album
    const photos = await Photo.find({ albumId });

    // Delete all photos and associated files. Photos from chat only point at
    // chat's files, which stay for the chat and were never metered here.
    const owned = photos.filter((photo) => !photo.source);
    for (const photo of owned) {
      try {
        if (photo.minioFileId) {
          await deleteFile(photo.minioFileId);
        }
        if (photo.minioThumbnailFileId) {
          await deleteFile(photo.minioThumbnailFileId);
        }
      } catch (error) {
        logger.error('Failed to delete file', { fileId: photo.minioFileId, error: (error as Error)?.message });
      }
    }

    const freedBytes = owned.reduce((sum, photo) => sum + (photo.size ?? 0), 0);

    // Delete all photos from database
    await Photo.deleteMany({ albumId });

    // Delete the album
    await Album.findByIdAndDelete(albumId);

    return { userId: album.userId, groupId: album.groupId, bytes: freedBytes };
  }

  /**
   * Set cover photo for album
   */
  async setCoverPhoto(albumId: string, photoId: string, context: AlbumPermissionContext): Promise<IAlbum> {
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    // Both cover routes took no caller at all, so anyone signed in could change
    // any album's cover. Public albums are readable, not writable.
    if (!canAccessResource(context.userId, album.userId, album.groupId, context.userGroups)) {
      throw new ForbiddenError('Access denied');
    }

    // Check if photo exists and belongs to the album
    const photo = await Photo.findOne({ _id: photoId, albumId });
    if (!photo) {
      throw new NotFoundError('Photo not found in this album');
    }

    // Update album cover photo
    album.coverPhotoId = photoId;
    return album.save();
  }

  /**
   * Remove cover photo from album
   */
  async removeCoverPhoto(albumId: string, context: AlbumPermissionContext): Promise<IAlbum> {
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    if (!canAccessResource(context.userId, album.userId, album.groupId, context.userGroups)) {
      throw new ForbiddenError('Access denied');
    }

    album.coverPhotoId = undefined;
    return album.save();
  }

  /**
   * Private helper: Enrich albums with cover photos
   */
  private async enrichAlbumsWithCoverPhotos(albums: AlbumAggRow[]): Promise<AlbumWithCoverPhoto[]> {
    const coverPhotoIds = Array.from(
      new Set(albums.filter((album) => album.coverPhotoId).map((album) => album.coverPhotoId!.toString()))
    );

    let coverPhotoMap = new Map<string, PhotoWithSignedUrls>();
    if (coverPhotoIds.length > 0) {
      const coverPhotoDocs = await Photo.find({ _id: { $in: coverPhotoIds } });
      let signedUrlMap: Record<string, SignedUrlData> = {};
      let thumbnailSignedUrlMap: Record<string, SignedUrlData> = {};

      try {
        signedUrlMap = await getPhotoSignedUrlsBatch(coverPhotoDocs, false, 60);
        thumbnailSignedUrlMap = await getPhotoSignedUrlsBatch(coverPhotoDocs, true, 60);
      } catch (error) {
        logger.error('Failed to fetch batch signed URLs for cover photos', { error: (error as Error)?.message });
      }

      coverPhotoMap = new Map<string, PhotoWithSignedUrls>(
        coverPhotoDocs.map((photo) => {
          const signedUrlData = signedUrlMap[photo.minioFileId || ''];
          const thumbnailSignedUrlData = thumbnailSignedUrlMap[photo.minioFileId || ''];

          // For GIFs, don't use thumbnails - show original instead
          const isGif = photo.mimetype === 'image/gif';
          const effectiveThumbnailSignedUrl = isGif ? null : thumbnailSignedUrlData?.signedUrl || null;
          const effectiveThumbnailExpiresAt = isGif ? null : thumbnailSignedUrlData?.expiresAt || null;
          const effectiveThumbnailExpiresInMinutes = isGif ? null : thumbnailSignedUrlData?.expiresInMinutes || null;

          return [
            photo.id,
            {
              ...photo.toObject(),
              signedUrl: signedUrlData?.signedUrl || null,
              signedUrlExpiresAt: signedUrlData?.expiresAt || null,
              signedUrlExpiresInMinutes: signedUrlData?.expiresInMinutes || null,
              thumbnailSignedUrl: effectiveThumbnailSignedUrl,
              thumbnailSignedUrlExpiresAt: effectiveThumbnailExpiresAt,
              thumbnailSignedUrlExpiresInMinutes: effectiveThumbnailExpiresInMinutes
            }
          ];
        })
      );
    }

    // Combine albums with cover photos
    return albums.map((album) => ({
      ...album,
      coverPhoto: album.coverPhotoId ? coverPhotoMap.get(album.coverPhotoId.toString()) || null : null
    }));
  }

  /**
   * Private helper: Enrich photo with signed URLs
   */
  private async enrichPhotoWithSignedUrls(photo: PhotoDocLike): Promise<PhotoWithSignedUrls> {
    try {
      const signedUrlData = await getPhotoSignedUrl(photo, false, 60);
      const thumbnailSignedUrlData = await getPhotoSignedUrl(photo, true, 60);

      if (signedUrlData) {
        // For GIFs, don't use thumbnails - show original instead
        const isGif = photo.mimetype === 'image/gif';
        const effectiveThumbnailSignedUrl = isGif ? null : thumbnailSignedUrlData?.signedUrl || null;
        const effectiveThumbnailExpiresAt = isGif ? null : thumbnailSignedUrlData?.expiresAt || null;
        const effectiveThumbnailExpiresInMinutes = isGif ? null : thumbnailSignedUrlData?.expiresInMinutes || null;

        return {
          ...photo,
          signedUrl: signedUrlData.signedUrl,
          signedUrlExpiresAt: signedUrlData.expiresAt,
          signedUrlExpiresInMinutes: signedUrlData.expiresInMinutes,
          thumbnailSignedUrl: effectiveThumbnailSignedUrl,
          thumbnailSignedUrlExpiresAt: effectiveThumbnailExpiresAt,
          thumbnailSignedUrlExpiresInMinutes: effectiveThumbnailExpiresInMinutes
        };
      }
    } catch (error) {
      logger.error('Failed to get cover photo signed URLs', { error: (error as Error)?.message });
    }

    return photo;
  }
}

export default new AlbumService();
