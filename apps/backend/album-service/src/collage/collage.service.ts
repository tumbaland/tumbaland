import { CollageInput } from './collage.types';
import { CollageModel, ICollage } from './collage.model';
import { applyChanges, CollageChange, StoredConfig } from './collageChanges';
import Album from '../models/Album';
import { getSignedUrlsBatch } from '../services/fileServiceClient';
import mongoose, { PipelineStage } from 'mongoose';
import { canAccessResource, ConflictError, ForbiddenError, logger, NotFoundError } from '@tumbaland/backend-core';

interface AggregatedPhoto {
  _id: unknown;
  filename: string;
  minioFileId?: string;
  minioThumbnailFileId?: string;
  mimetype: string;
  createdAt: Date;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
  tags: string[];
}

interface AlbumWithPhotosAggRow {
  _id: unknown;
  userId?: string;
  groupId?: string;
  isPublic?: boolean;
  photos: AggregatedPhoto[];
}

interface PhotoWithSignedUrl extends AggregatedPhoto {
  signedUrl?: string;
  signedUrlExpiresAt?: string;
  signedUrlExpiresInMinutes?: number;
  thumbnailSignedUrl?: string;
  thumbnailSignedUrlExpiresAt?: string;
  thumbnailSignedUrlExpiresInMinutes?: number;
}

interface CollageListFilter {
  albumIds?: { $in: string[] };
  groupId?: string | { $exists: false };
  userId?: string;
}

export const createCollage = async (
  data: CollageInput,
  userId: string,
  userGroups: string[] = []
): Promise<ICollage> => {
  // Creating a collage in a group is writing into that group.
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  // Set the userId on the collage data
  const collageData = {
    ...data,
    userId
  };

  const collage = new CollageModel(collageData);
  await collage.save();
  return collage;
};

export const updateCollage = async (
  id: string,
  data: CollageInput,
  userId: string,
  userGroups: string[] = []
): Promise<ICollage | null> => {
  // First check if user has access to this collage
  const existingCollage = await CollageModel.findById(id);
  if (!existingCollage) {
    throw new NotFoundError('Collage not found');
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingCollage.userId || '',
    existingCollage.groupId,
    userGroups,
    false // collages are not public
  );

  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  // Moving a collage into a group is writing into that group.
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  // Counted as a write like any other, so a batch of changes read before
  // this one is retried against it rather than stored over it.
  const collage = await CollageModel.findByIdAndUpdate(id, { ...data, $inc: { revision: 1 } }, { new: true });
  return collage;
};

export type CollageChanges = CollageChange[];

/** How many times a batch is re-applied when another write lands first. */
const CHANGE_ATTEMPTS = 5;

/**
 * Apply a batch of small changes to a collage's config.
 *
 * Read, apply, and store only if the revision is still the one read. When the
 * other person's batch got there first, this one is applied again on top of
 * theirs: both land, and neither overwrites the other.
 */
export const applyCollageChanges = async (
  id: string,
  changes: CollageChange[],
  userId: string,
  userGroups: string[] = []
): Promise<{ revision: number }> => {
  for (let attempt = 0; attempt < CHANGE_ATTEMPTS; attempt += 1) {
    const current = await CollageModel.findById(id).select('userId groupId config revision').lean();
    if (!current) {
      throw new NotFoundError('Collage not found');
    }
    if (!canAccessResource(userId, current.userId || '', current.groupId, userGroups, false)) {
      throw new ForbiddenError('Access denied');
    }

    const config = applyChanges((current.config ?? {}) as unknown as StoredConfig, changes);
    // Collages from before revisions existed have no field at all, and
    // `{ revision: 0 }` would not match them.
    const seen = typeof current.revision === 'number' ? current.revision : { $exists: false };

    const stored = await CollageModel.findOneAndUpdate(
      { _id: id, revision: seen },
      { $set: { config }, $inc: { revision: 1 } },
      { returnDocument: 'after', projection: { revision: 1 } }
    ).lean();
    if (stored) return { revision: stored.revision };
  }

  logger.warn('Collage changes kept losing the race', { collageId: id });
  throw new ConflictError('The collage is being changed too quickly. Try again.');
};

export const getCollageById = async (
  id: string,
  userId: string,
  userGroups: string[] = []
): Promise<ICollage | null> => {
  const collage = await CollageModel.findById(id);

  if (!collage) {
    return null;
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    collage.userId || '',
    collage.groupId,
    userGroups,
    false // collages are not public
  );

  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  return collage;
};

/**
 * Get collage with all photos from its albums
 */
export const getCollageWithPhotos = async (
  id: string,
  userId: string,
  userGroups: string[] = []
): Promise<{ collage: ICollage; photos: PhotoWithSignedUrl[] }> => {
  const collage = await getCollageById(id, userId, userGroups);

  if (!collage) {
    throw new NotFoundError('Collage not found');
  }

  // Use aggregation to fetch photos from all albums in the collage
  const aggregationPipeline: PipelineStage[] = [
    { $match: { _id: { $in: collage.albumIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    {
      $lookup: {
        from: 'photos',
        localField: '_id',
        foreignField: 'albumId',
        as: 'photos'
      }
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        groupId: 1,
        isPublic: 1,
        photos: {
          $map: {
            input: '$photos',
            as: 'photo',
            in: {
              _id: '$$photo._id',
              filename: '$$photo.filename',
              minioFileId: '$$photo.minioFileId',
              minioThumbnailFileId: '$$photo.minioThumbnailFileId',
              mimetype: '$$photo.mimetype',
              createdAt: '$$photo.createdAt',
              title: '$$photo.title',
              description: '$$photo.description',
              width: '$$photo.width',
              height: '$$photo.height',
              // Carried through so the editor's photo tray can filter a
              // multi-album pile down to the tags the collage is about.
              tags: { $ifNull: ['$$photo.tags', []] }
            }
          }
        }
      }
    }
  ];

  const albumsWithPhotos = await Album.aggregate<AlbumWithPhotosAggRow>(aggregationPipeline);

  // Check access permissions for all albums
  for (const album of albumsWithPhotos) {
    const hasAlbumAccess = canAccessResource(
      userId,
      album.userId || '',
      album.groupId,
      userGroups,
      false // albums are not public
    );

    if (!hasAlbumAccess) {
      throw new ForbiddenError('Access denied to one or more albums');
    }
  }

  // Flatten all photos and fetch every signed URL (originals + thumbnails)
  // in a single batch request to file-service.
  const allPhotos = albumsWithPhotos.flatMap((album) => album.photos);
  let urlMap: Awaited<ReturnType<typeof getSignedUrlsBatch>> = {};
  try {
    urlMap = await getSignedUrlsBatch(
      allPhotos
        .flatMap((photo) => [photo.minioFileId, photo.minioThumbnailFileId])
        .filter((id): id is string => Boolean(id)),
      60
    );
  } catch (error) {
    logger.error('Failed to get signed URLs for collage photos', { error: (error as Error)?.message });
  }

  const photosWithUrls: PhotoWithSignedUrl[] = allPhotos.map((photo) => {
    const original = photo.minioFileId ? urlMap[photo.minioFileId] : undefined;
    const thumbnail = photo.minioThumbnailFileId ? urlMap[photo.minioThumbnailFileId] : undefined;
    return {
      ...photo,
      signedUrl: original?.signedUrl,
      signedUrlExpiresAt: original?.expiresAt,
      signedUrlExpiresInMinutes: original?.expiresInMinutes,
      thumbnailSignedUrl: thumbnail?.signedUrl,
      thumbnailSignedUrlExpiresAt: thumbnail?.expiresAt,
      thumbnailSignedUrlExpiresInMinutes: thumbnail?.expiresInMinutes
    };
  });

  return { collage, photos: photosWithUrls };
};

export const getCollageList = async (
  albumId?: string,
  userId?: string,
  userGroups: string[] = [],
  groupId?: string
): Promise<ICollage[]> => {
  const filter: CollageListFilter = {};

  // Add album filter if provided
  if (albumId) {
    filter.albumIds = { $in: [albumId] };
  }

  // Apply permission filtering
  if (userId) {
    if (groupId) {
      // If groupId is specified, filter by group (user must be member)
      if (!userGroups.includes(groupId)) {
        throw new ForbiddenError('Access denied');
      }
      filter.groupId = groupId;
    } else {
      // No groupId specified: show only personal collages (no group)
      filter.userId = userId;
      filter.groupId = { $exists: false };
    }
  }

  return CollageModel.find(filter).sort({ createdAt: -1 });
};

export const deleteCollage = async (id: string, userId: string, userGroups: string[] = []): Promise<void> => {
  // First check if user has access to this collage
  const existingCollage = await CollageModel.findById(id);
  if (!existingCollage) {
    throw new NotFoundError('Collage not found');
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingCollage.userId || '',
    existingCollage.groupId,
    userGroups,
    false // collages are not public
  );

  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  await CollageModel.findByIdAndDelete(id);
};
