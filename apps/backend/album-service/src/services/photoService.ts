import { HydratedDocument } from 'mongoose';
import Photo, { IPhoto } from '../models/Photo';
import Album from '../models/Album';
import { BadRequestError, ConflictError, logger, NotFoundError } from '@tumbaland/backend-core';
import { albumFolder, deleteFile, getFile, storedSize } from './fileServiceClient';
import { generateThumbnailFromBuffer, isSupportedImageFormat } from './thumbnailService';
import { assertPhotoReachable, canReachAlbum, PhotoAccessContext } from './photoAccess';
import { bulkUpdateTags, BulkTagInput, getAlbumTags, normalizeTags, TagCount, TagMatch } from './photoTags';
import { attachSignedUrls, enrichPhotoWithSignedUrl, PhotoWithSignedUrls } from './photoUrls';
import { announceAlbumPhotos } from '../collage/albumPhotosLive';

export type { PhotoWithSignedUrls } from './photoUrls';

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

export interface GetPhotosFilter {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  /** 'all' (default) keeps photos carrying every selected tag; 'any' widens to a union. */
  tagMatch?: TagMatch;
}

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
    void announceAlbumPhotos([albumId]);

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

    const photosWithUrls = await attachSignedUrls(photos);

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

    return enrichPhotoWithSignedUrl(photo);
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

  /** List every tag used by an album's photos, most used first. See photoTags. */
  getAlbumTags(albumId: string, context: PhotoAccessContext): Promise<TagCount[]> {
    return getAlbumTags(albumId, context);
  }

  /** Add and/or remove tags across many photos at once. See photoTags. */
  bulkUpdateTags(
    input: BulkTagInput,
    context: PhotoAccessContext
  ): Promise<{ matched: number; modified: number; tags: TagCount[] }> {
    return bulkUpdateTags(input, context);
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

  /** Attach original + thumbnail signed URLs to a set of photos. See photoUrls. */
  attachSignedUrls(photos: HydratedDocument<IPhoto>[]): Promise<PhotoWithSignedUrls[]> {
    return attachSignedUrls(photos);
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
}

export default new PhotoService();
