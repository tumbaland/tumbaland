import { HydratedDocument } from 'mongoose';
import { IPhoto } from '../models/Photo';
import { logger } from '@tumbaland/backend-core';
import { getPhotoSignedUrl, getPhotoSignedUrlsBatch, getSignedUrlsBatch, SignedUrlData } from './fileServiceClient';

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
  /** A video's still (see Photo.minioPosterFileId). */
  posterSignedUrl?: string;
}

/**
 * Enrich photo with URLs from maps
 */
const enrichPhotoWithUrls = (
  photo: HydratedDocument<IPhoto>,
  signedUrlMap: Record<string, SignedUrlData>,
  thumbnailSignedUrlMap: Record<string, SignedUrlData>,
  posterSignedUrlMap: Record<string, SignedUrlData> = {}
): PhotoWithSignedUrls => {
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

  const poster = photo.minioPosterFileId ? posterSignedUrlMap[photo.minioPosterFileId] : undefined;
  if (poster) result.posterSignedUrl = poster.signedUrl;

  return result;
};

/**
 * Attach original + thumbnail signed URLs to a set of photos, in two batch
 * calls rather than one round trip per photo. Shared by every listing that
 * hands photos to a client — an album page, a memories strip — so they all
 * get the same URL shape and the same "a URL failure degrades, never fails
 * the request" behaviour.
 */
export const attachSignedUrls = async (photos: HydratedDocument<IPhoto>[]): Promise<PhotoWithSignedUrls[]> => {
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

  // Videos from chat carry a still; a third call, and only when there are any.
  const posterIds = photos.map((photo) => photo.minioPosterFileId).filter((id): id is string => Boolean(id));
  const posterSignedUrlMap = posterIds.length > 0 ? await getSignedUrlsBatch(posterIds, 60) : {};

  return photos.map((photo) => enrichPhotoWithUrls(photo, signedUrlMap, thumbnailSignedUrlMap, posterSignedUrlMap));
};

/**
 * Enrich a single photo with its signed URL
 */
export const enrichPhotoWithSignedUrl = async (photo: HydratedDocument<IPhoto>): Promise<PhotoWithSignedUrls> => {
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
};
