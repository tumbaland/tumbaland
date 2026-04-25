import { CollageInput } from './collage.types';
import { CollageModel, ICollage } from './collage.model';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';
import Album from '../models/Album';
import { getPhotoSignedUrl } from '../services/fileServiceClient';
import mongoose from 'mongoose';

export const createCollage = async (
  data: CollageInput, 
  userId: string, 
  userGroups: string[] = []
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
    return null;
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
    throw new Error('ACCESS_DENIED');
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
    throw new Error('ACCESS_DENIED');
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
): Promise<{ collage: ICollage; photos: any[] }> => {
  const collage = await getCollageById(id, userId, userGroups);
  
  if (!collage) {
    throw new Error('Collage not found');
  }

  // Use aggregation to fetch photos from all albums in the collage
  const aggregationPipeline: any[] = [
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
              description: '$$photo.description'
            }
          }
        }
      }
    }
  ];

  const albumsWithPhotos = await (Album as any).aggregate(aggregationPipeline);

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
      throw new Error('Access denied to one or more albums');
    }
  }

  // Flatten all photos and get signed URLs in parallel
  const allPhotos = albumsWithPhotos.flatMap((album: any) => album.photos);
  const photosWithUrls = await Promise.all(
    allPhotos.map(async (photo: any) => {
      try {
        const signedUrlData = await getPhotoSignedUrl(photo, false, 60);
        const thumbnailSignedUrlData = await getPhotoSignedUrl(photo, true, 60);

        return {
          ...photo,
          signedUrl: signedUrlData?.signedUrl,
          signedUrlExpiresAt: signedUrlData?.expiresAt,
          signedUrlExpiresInMinutes: signedUrlData?.expiresInMinutes,
          thumbnailSignedUrl: thumbnailSignedUrlData?.signedUrl,
          thumbnailSignedUrlExpiresAt: thumbnailSignedUrlData?.expiresAt,
          thumbnailSignedUrlExpiresInMinutes: thumbnailSignedUrlData?.expiresInMinutes
        };
      } catch (error) {
        console.error('Failed to get signed URLs for photo:', error);
        return {
          ...photo,
          signedUrl: undefined,
          thumbnailSignedUrl: undefined
        };
      }
    })
  );

  return { collage, photos: photosWithUrls };
};

export const getCollageList = async (
  albumId?: string, 
  userId?: string, 
  userGroups: string[] = [],
  groupId?: string
): Promise<ICollage[]> => {
  let filter: any = {};
  
  // Add album filter if provided
  if (albumId) {
    filter.albumIds = { $in: [albumId] };
  }

  // Apply permission filtering
  if (userId) {
    if (groupId) {
      // If groupId is specified, filter by group (user must be member)
      if (!userGroups.includes(groupId)) {
        throw new Error('ACCESS_DENIED');
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
    throw new Error('Collage not found');
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
    throw new Error('ACCESS_DENIED');
  }

  await CollageModel.findByIdAndDelete(id);
};
