import Photo from '../models/Photo';
import Album from '../models/Album';
import { ConflictError, logger, NotFoundError } from '@tumbaland/backend-core';
import {
  deleteFile,
  getPhotoSignedUrl,
  getPhotoSignedUrlsBatch,
  getFile,
  SignedUrlData
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
  metadata?: Record<string, any>;
}

export interface UpdatePhotoInput {
  title?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface GetPhotosFilter {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AIAnalysisUpdate {
  objectDetection?: {
    jobId: string;
    analyzedAt: Date;
    totalDetections: number;
    processingTime: number;
  };
  segmentation?: {
    jobId: string;
    analyzedAt: Date;
    totalMasks: number;
    segmentationType: string;
    processingTime: number;
  };
}

class PhotoService {
  /**
   * Create a new photo record
   */
  async createPhoto(input: CreatePhotoInput, userId: string, groupId?: string): Promise<any> {
    const {
      filename,
      originalName,
      fileId,
      minioFileId,
      albumId,
      title,
      description,
      mimetype,
      size,
      width,
      height,
      tags = [],
      metadata = {}
    } = input;

    // Use minioFileId if provided, otherwise use fileId (for backward compatibility).
    // Route-level schema validation already guarantees one of them is present.
    const actualMinioFileId = (minioFileId || fileId)!;

    // Check if album exists
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
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
      size,
      width,
      height,
      tags: tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0),
      metadata
    });

    const savedPhoto = await photo.save();

    // Generate thumbnail asynchronously for supported image formats (don't block photo creation)
    if (isSupportedImageFormat(mimetype)) {
      this.generateThumbnailAsync(
        savedPhoto._id.toString(),
        actualMinioFileId,
        originalName,
        userId,
        albumId,
        groupId
      );
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
    filter: GetPhotosFilter
  ): Promise<{
    photos: any[];
    pagination: {
      page: number;
      limit?: number;
      total: number;
      pages: number;
    };
  }> {
    const { page = 1, limit, search } = filter;

    // Check if album exists
    const album = await Album.findById(albumId);
    if (!album) {
      throw new NotFoundError('Album not found');
    }

    const query: any = { albumId };
    if (search) {
      query.$text = { $search: search };
    }

    // Handle pagination - if limit is not provided or is 0, fetch all photos
    const limitNum = limit ? Number(limit) : undefined;
    const pageNum = Number(page);

    let photosQuery = Photo.find(query).sort({ createdAt: -1 });

    if (limitNum && limitNum > 0) {
      photosQuery = photosQuery.limit(limitNum).skip((pageNum - 1) * limitNum);
    }

    const [photos, total] = await Promise.all([photosQuery, Photo.countDocuments(query)]);

    // Fetch signed URLs in batch
    let signedUrlMap: Record<string, SignedUrlData> = {};
    try {
      signedUrlMap = await getPhotoSignedUrlsBatch(photos, false, 60);
    } catch (error) {
      logger.error('Failed to fetch batch signed URLs for album photos', { error: (error as Error)?.message });
    }

    // Get thumbnail URLs for photos that have thumbnails
    const photosWithThumbnails = photos.filter((photo) => photo.minioThumbnailFileId);
    let thumbnailSignedUrlMap: Record<string, SignedUrlData> = {};

    if (photosWithThumbnails.length > 0) {
      try {
        thumbnailSignedUrlMap = await getPhotoSignedUrlsBatch(photosWithThumbnails, true, 60);
      } catch (error) {
        logger.error('Failed to fetch batch signed URLs for thumbnails', { error: (error as Error)?.message });
      }
    }

    const photosWithUrls = photos.map((photo) => this.enrichPhotoWithUrls(photo, signedUrlMap, thumbnailSignedUrlMap));

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
  async getPhotoById(photoId: string): Promise<any> {
    const photo = await Photo.findById(photoId).populate('albumId');

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    return this.enrichPhotoWithSignedUrl(photo);
  }

  /**
   * Get photo by file ID (used for public/file-service lookups)
   */
  async getPhotoByFileId(fileId: string): Promise<any> {
    const photo = await Photo.findOne({ minioFileId: fileId }).populate('albumId');

    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    return photo;
  }

  /**
   * Update photo metadata
   */
  async updatePhoto(photoId: string, input: UpdatePhotoInput): Promise<any> {
    const photo = await Photo.findById(photoId);
    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title?.trim();
    if (input.description !== undefined) updateData.description = input.description?.trim();
    if (input.tags) {
      updateData.tags = input.tags
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    }
    if (input.metadata) updateData.metadata = input.metadata;

    return Photo.findByIdAndUpdate(photoId, updateData, { new: true });
  }

  /**
   * Delete photo and associated files
   */
  async deletePhoto(photoId: string): Promise<void> {
    const photo = await Photo.findById(photoId);
    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    // Delete associated files
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

    // Delete the photo record
    await Photo.findByIdAndDelete(photoId);

    // If this was the cover photo, remove it from the album
    const album = await Album.findOne({ coverPhotoId: photoId });
    if (album) {
      album.coverPhotoId = undefined;
      await album.save();
    }
  }

  /**
   * Update photo AI analysis results
   */
  async updatePhotoAIAnalysis(photoId: string, analysis: AIAnalysisUpdate): Promise<any> {
    const photo = await Photo.findById(photoId);
    if (!photo) {
      throw new NotFoundError('Photo not found');
    }

    const updateData: any = {};
    if (analysis.objectDetection) {
      updateData.objectDetection = analysis.objectDetection;
    }
    if (analysis.segmentation) {
      updateData.segmentation = analysis.segmentation;
    }

    return Photo.findByIdAndUpdate(photoId, updateData, { new: true });
  }

  /**
   * Get photos for AI analysis (batch retrieval)
   */
  async getPhotosForAIAnalysis(albumId: string, limit: number = 50): Promise<any[]> {
    const photos = await Photo.find({ albumId })
      .limit(limit)
      .sort({ createdAt: -1 });

    return photos;
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
        const thumbnailResult = await generateThumbnailFromBuffer(
          imageBuffer,
          originalName,
          userId,
          albumId,
          groupId
        );

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
   * Private helper: Enrich photo with signed URL
   */
  private async enrichPhotoWithSignedUrl(photo: any): Promise<any> {
    try {
      const signedUrlData = await getPhotoSignedUrl(photo, false, 60);
      const result: any = {
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
    photo: any,
    signedUrlMap: Record<string, SignedUrlData>,
    thumbnailSignedUrlMap: Record<string, SignedUrlData>
  ): any {
    const signedUrlData = signedUrlMap[photo.minioFileId || ''];
    const photoObj = photo.toObject();

    const result: any = { ...photoObj };

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
