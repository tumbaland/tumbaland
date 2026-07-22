import Album, { IAlbum } from '../models/Album';
import Photo from '../models/Photo';
import mongoose, { PipelineStage } from 'mongoose';
import { canAccessResource, ForbiddenError, logger, NotFoundError } from '@tumbaland/backend-core';
import {
  deleteFile,
  getPhotoSignedUrl,
  getPhotoSignedUrlsBatch,
  SignedUrlData
} from './fileServiceClient';

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
    const {
      page = 1,
      limit = 10,
      search,
      isPublic,
      groupId,
      includeCover = true
    } = filter;
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

    // Use aggregation pipeline to get albums with photo counts in one query
    const aggregationPipeline: PipelineStage[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'photos',
          localField: '_id',
          foreignField: 'albumId',
          as: 'photos'
        }
      },
      {
        $addFields: {
          photoCount: { $size: '$photos' }
        }
      },
      {
        $project: {
          photos: 0 // Remove the photos array from result
        }
      },
      { $sort: { updatedAt: -1 as -1 } },
      { $skip: skip },
      { $limit: Number(limit) }
    ];

    // Get total count for pagination
    const totalPipeline: PipelineStage[] = [
      { $match: matchQuery },
      { $count: 'total' }
    ];

    const [albumsResult, totalResult] = await Promise.all([
      Album.aggregate<AlbumAggRow>(aggregationPipeline),
      Album.aggregate<{ total: number }>(totalPipeline)
    ]);

    const total = totalResult[0]?.total || 0;

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

    // Use aggregation to get album with photo count and cover photo in one query
    const aggregationPipeline: PipelineStage[] = [
      { $match: { _id: new mongoose.Types.ObjectId(albumId as string) } },
      {
        $lookup: {
          from: 'photos',
          let: { albumId: '$_id', coverPhotoId: '$coverPhotoId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$albumId', '$$albumId'] },
                    { $eq: ['$_id', '$$coverPhotoId'] }
                  ]
                }
              }
            }
          ],
          as: 'relatedPhotos'
        }
      },
      {
        $addFields: {
          photoCount: {
            $size: {
              $filter: {
                input: '$relatedPhotos',
                cond: { $eq: ['$$this.albumId', '$_id'] }
              }
            }
          },
          coverPhotoDoc: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$relatedPhotos',
                  cond: { $eq: ['$$this._id', '$coverPhotoId'] }
                }
              },
              0
            ]
          }
        }
      },
      {
        $project: {
          relatedPhotos: 0
        }
      }
    ];

    const albumResult = await Album.aggregate<AlbumByIdAggRow>(aggregationPipeline);

    if (!albumResult || albumResult.length === 0) {
      throw new NotFoundError('Album not found');
    }

    const albumData = albumResult[0];

    // Check if user can access this album
    const hasAccess = canAccessResource(
      userId,
      albumData.userId,
      albumData.groupId,
      userGroups,
      albumData.isPublic
    );

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
  async updateAlbum(
    albumId: string,
    input: UpdateAlbumInput,
    context: AlbumPermissionContext
  ): Promise<IAlbum | null> {
    const { userId, userGroups } = context;

    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    // Check if user can modify this album
    const hasAccess = canAccessResource(
      userId,
      album.userId,
      album.groupId,
      userGroups,
      album.isPublic
    );

    if (!hasAccess) {
      throw new ForbiddenError('Access denied');
    }

    const updateData: Partial<Pick<IAlbum, 'name' | 'description' | 'isPublic' | 'tags' | 'coverPhotoId' | 'groupId'>> = {};
    if (input.name) updateData.name = input.name.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim();
    if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;
    if (input.tags) {
      updateData.tags = input.tags
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }
    if (input.coverPhotoId !== undefined) updateData.coverPhotoId = input.coverPhotoId;
    if (input.groupId !== undefined) updateData.groupId = input.groupId;

    return Album.findByIdAndUpdate(albumId, updateData, { new: true });
  }

  /**
   * Delete album and all associated photos and files
   */
  async deleteAlbum(albumId: string): Promise<void> {
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    // Get all photos in the album
    const photos = await Photo.find({ albumId });

    // Delete all photos and associated files
    for (const photo of photos) {
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

    // Delete all photos from database
    await Photo.deleteMany({ albumId });

    // Delete the album
    await Album.findByIdAndDelete(albumId);
  }

  /**
   * Set cover photo for album
   */
  async setCoverPhoto(albumId: string, photoId: string): Promise<IAlbum> {
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
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
  async removeCoverPhoto(albumId: string): Promise<IAlbum> {
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    album.coverPhotoId = undefined;
    return album.save();
  }

  /**
   * Private helper: Enrich albums with cover photos
   */
  private async enrichAlbumsWithCoverPhotos(albums: AlbumAggRow[]): Promise<AlbumWithCoverPhoto[]> {
    const coverPhotoIds = Array.from(
      new Set(
        albums
          .filter((album) => album.coverPhotoId)
          .map((album) => album.coverPhotoId!.toString())
      )
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
          const effectiveThumbnailExpiresInMinutes = isGif
            ? null
            : thumbnailSignedUrlData?.expiresInMinutes || null;

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
        const effectiveThumbnailExpiresInMinutes = isGif
          ? null
          : thumbnailSignedUrlData?.expiresInMinutes || null;

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
