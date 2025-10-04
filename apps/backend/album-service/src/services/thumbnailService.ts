import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { uploadFile, generateThumbnailFileId } from './minioService';
import { logger } from '@tumbaland/core';

export interface ThumbnailOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

export interface ThumbnailResult {
  thumbnailFileId: string;
  width: number;
  height: number;
  size: number;
}

/**
 * Default thumbnail options
 */
const DEFAULT_THUMBNAIL_OPTIONS: Required<ThumbnailOptions> = {
  width: 300,
  height: 300,
  quality: 80,
  format: 'jpeg'
};

/**
 * Generate a thumbnail from an image buffer
 */
export const generateThumbnailFromBuffer = async (
  imageBuffer: Buffer,
  originalFilename: string,
  userId: string,
  albumId: string,
  groupId?: string,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> => {
  const opts = { ...DEFAULT_THUMBNAIL_OPTIONS, ...options };

  try {
    // Generate thumbnail using Sharp
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(opts.width, opts.height, {
        fit: 'inside', // Maintain aspect ratio
        withoutEnlargement: true // Don't enlarge if smaller than target
      })
      .jpeg({ quality: opts.quality })
      .toBuffer();

    // Generate thumbnail file ID
    const thumbnailFileId = generateThumbnailFileId(userId, albumId, originalFilename, groupId);

    // Get image metadata for the thumbnail
    const metadata = await sharp(thumbnailBuffer).metadata();

    // Upload thumbnail to MinIO
    const uploadResult = await uploadFile(
      thumbnailBuffer,
      thumbnailFileId,
      `image/${opts.format}`,
      thumbnailBuffer.length
    );

    logger.info(`Thumbnail generated and uploaded: ${thumbnailFileId}`, {
      originalSize: imageBuffer.length,
      thumbnailSize: thumbnailBuffer.length,
      dimensions: `${metadata.width}x${metadata.height}`
    });

    return {
      thumbnailFileId,
      width: metadata.width || opts.width,
      height: metadata.height || opts.height,
      size: thumbnailBuffer.length
    };
  } catch (error) {
    logger.error('Failed to generate thumbnail:', error);
    throw new Error('Thumbnail generation failed');
  }
};

/**
 * Generate a thumbnail from a file path
 */
export const generateThumbnailFromFile = async (
  filePath: string,
  originalFilename: string,
  userId: string,
  albumId: string,
  groupId?: string,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult> => {
  try {
    // Read the original file
    const imageBuffer = fs.readFileSync(filePath);

    return await generateThumbnailFromBuffer(
      imageBuffer,
      originalFilename,
      userId,
      albumId,
      groupId,
      options
    );
  } catch (error) {
    logger.error(`Failed to read file for thumbnail generation: ${filePath}`, error);
    throw new Error('Failed to read source file for thumbnail generation');
  }
};

/**
 * Generate thumbnails for multiple images in batch
 */
export const generateThumbnailsBatch = async (
  imagePaths: Array<{
    filePath: string;
    originalFilename: string;
    userId: string;
    albumId: string;
    groupId?: string;
  }>,
  options: ThumbnailOptions = {}
): Promise<ThumbnailResult[]> => {
  const results: ThumbnailResult[] = [];

  // Process in batches to avoid overwhelming the system
  const batchSize = 5;
  for (let i = 0; i < imagePaths.length; i += batchSize) {
    const batch = imagePaths.slice(i, i + batchSize);

    const batchPromises = batch.map(async (item) => {
      try {
        const result = await generateThumbnailFromFile(
          item.filePath,
          item.originalFilename,
          item.userId,
          item.albumId,
          item.groupId,
          options
        );
        return result;
      } catch (error) {
        logger.warn(`Failed to generate thumbnail for ${item.filePath}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter((result): result is ThumbnailResult => result !== null));

    logger.info(`Processed thumbnail batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(imagePaths.length / batchSize)}`);
  }

  return results;
};

/**
 * Check if an image format is supported for thumbnail generation
 * Note: GIFs are excluded because they are animated and static thumbnails don't represent them well
 * Videos are excluded as they require different processing (video thumbnails)
 */
export const isSupportedImageFormat = (mimetype: string): boolean => {
  const supportedFormats = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/tiff',
    'image/bmp'
    // Note: 'image/gif' excluded - GIFs are animated, static thumbnails don't represent them well
    // Videos (video/*) are not supported for image thumbnail generation
  ];

  return supportedFormats.includes(mimetype.toLowerCase());
};