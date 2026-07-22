import { CollageInput } from './collage.types';
import { CollageModel, ICollage } from './collage.model';
import Album from '../models/Album';
import { getSignedUrlsBatch } from '../services/fileServiceClient';
import mongoose, { PipelineStage } from 'mongoose';
import { canAccessResource, ForbiddenError, logger, NotFoundError } from '@tumbaland/backend-core';

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
  _userGroups: string[] = []
): Promise<ICollage> => {
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

  const collage = await CollageModel.findByIdAndUpdate(id, data, { new: true });
  return collage;
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
    { $match: { _id: { $in: collage.albumIds.map(id => new mongoose.Types.ObjectId(id)) } } },
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
              height: '$$photo.height'
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
      allPhotos.flatMap((photo) => [photo.minioFileId, photo.minioThumbnailFileId]).filter((id): id is string => Boolean(id)),
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

export const deleteCollage = async (
  id: string, 
  userId: string, 
  userGroups: string[] = []
): Promise<void> => {
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
