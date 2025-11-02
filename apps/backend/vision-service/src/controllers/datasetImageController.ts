import { Request, Response } from 'express';
import DatasetImage from '../models/DatasetImage';
import Dataset from '../models/Dataset';
import {
  deleteFile,
  getSignedUrl,
  getPhotoSignedUrl,
  getPhotoSignedUrlsBatch,
  getUploadSignedUrl,
  generateFileId,
  SignedUrlData
} from '../services/minioService';
import { logger } from '@tumbaland/core';

export const createDatasetImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      filename,
      originalName,
      minioFileId,
      datasetId,
      title,
      description,
      mimetype,
      size,
      width,
      height,
      tags = [],
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!filename || !originalName || !minioFileId || !datasetId || !mimetype || !size) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, originalName, minioFileId, datasetId, mimetype, size'
      });
      return;
    }

    // Note: We don't validate dataset existence here since datasetId can be any string identifier
    // (e.g., dataset name like "zod", "waymo", etc.)

    // Check if image with this minioFileId already exists
    const existingImage = await DatasetImage.findOne({ minioFileId });
    if (existingImage) {
      res.status(409).json({
        success: false,
        message: 'Image with this MinIO file ID already exists'
      });
      return;
    }

    const image = new DatasetImage({
      filename,
      originalName,
      minioFileId,
      datasetId,
      title: title?.trim(),
      description: description?.trim(),
      mimetype,
      size,
      width,
      height,
      tags: tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0),
      metadata
    });

    const savedImage = await image.save();

    logger.info(`Dataset image created: ${savedImage._id}`, {
      datasetId,
      minioFileId
    });

    res.status(201).json({
      success: true,
      message: 'Dataset image created successfully',
      data: savedImage
    });
  } catch (error) {
    logger.error('Error creating dataset image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dataset image'
    });
  }
};

// Get images by dataset
export const getImagesByDataset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { datasetId } = req.params;
    const { page = 1, limit, search } = req.query;

    // Note: We don't validate dataset existence here since datasetId can be any string identifier
    // (e.g., dataset name like "zod", "waymo", etc., or analysis ID)

    const query: any = { datasetId };
    if (search) {
      query.$text = { $search: search as string };
    }

    const limitNum = limit ? Number(limit) : undefined;
    const pageNum = Number(page);

    let imagesQuery = DatasetImage.find(query).sort({ createdAt: -1 });

    if (limitNum && limitNum > 0) {
      imagesQuery = imagesQuery.limit(limitNum).skip((pageNum - 1) * limitNum);
    }

    const images = await imagesQuery;
    const total = await DatasetImage.countDocuments(query);

    // If no images found, return empty array
    if (images.length === 0) {
      res.json({
        success: true,
        data: {
          images: [],
          pagination: {
            page: pageNum,
            limit: limitNum || 0,
            total: 0,
            pages: 0
          }
        }
      });
      return;
    }

    const fileIds = images.map((image) => image.minioFileId).filter(Boolean);
    let signedUrlMap: Record<string, SignedUrlData> = {};

    try {
      signedUrlMap = await getPhotoSignedUrlsBatch(images, false, 60);
    } catch (error) {
      logger.error('Failed to fetch batch signed URLs for dataset images:', error);
      // Continue without signed URLs
    }

    // Get thumbnail URLs for images that have thumbnails
    const imagesWithThumbnails = images.filter((image) => image.minioThumbnailFileId);
    let thumbnailSignedUrlMap: Record<string, SignedUrlData> = {};

    if (imagesWithThumbnails.length > 0) {
      try {
        thumbnailSignedUrlMap = await getPhotoSignedUrlsBatch(imagesWithThumbnails, true, 60);
      } catch (error) {
        logger.error('Failed to fetch batch signed URLs for thumbnails:', error);
        // Continue without thumbnail URLs
      }
    }

    const imagesWithUrls = images.map((image) => {
      const signedUrlData = signedUrlMap[image.minioFileId || ''];
      const imageObj = image.toObject();

      const result: any = { ...imageObj };

      if (signedUrlData) {
        result.signedUrl = signedUrlData.signedUrl;
        result.signedUrlExpiresAt = signedUrlData.expiresAt;
        result.signedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
      }

      // For images with minioThumbnailFileId, try to get thumbnail signed URL
      if (image.minioThumbnailFileId) {
        const thumbnailSignedUrlData = thumbnailSignedUrlMap[image.minioFileId || ''];
        if (thumbnailSignedUrlData) {
          result.thumbnailSignedUrl = thumbnailSignedUrlData.signedUrl;
          result.thumbnailSignedUrlExpiresAt = thumbnailSignedUrlData.expiresAt;
          result.thumbnailSignedUrlExpiresInMinutes = thumbnailSignedUrlData.expiresInMinutes;
        }
      } else {
        // For images without thumbnails, use original as thumbnail
        if (signedUrlData) {
          result.thumbnailSignedUrl = signedUrlData.signedUrl;
          result.thumbnailSignedUrlExpiresAt = signedUrlData.expiresAt;
          result.thumbnailSignedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
        }
      }

      return result;
    });

    res.json({
      success: true,
      data: {
        images: imagesWithUrls,
        pagination: {
          page: pageNum,
          limit: limitNum || 0,
          total,
          pages: limitNum && limitNum > 0 ? Math.ceil(total / limitNum) : 1
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching dataset images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dataset images'
    });
  }
};

// Get image by ID
export const getImageById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const image = await DatasetImage.findById(id).populate('datasetId');

    if (!image) {
      res.status(404).json({
        success: false,
        message: 'Dataset image not found'
      });
      return;
    }

    try {
      const signedUrlData = await getPhotoSignedUrl(image, false, 60);
      const result: any = {
        ...image.toObject()
      };

      if (signedUrlData) {
        result.signedUrl = signedUrlData.signedUrl;
        result.signedUrlExpiresAt = signedUrlData.expiresAt;
        result.signedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
      }

      // Add thumbnail URL if available
      if (image.minioThumbnailFileId) {
        try {
          const thumbnailSignedUrlData = await getPhotoSignedUrl(image, true, 60);
          if (thumbnailSignedUrlData) {
            result.thumbnailSignedUrl = thumbnailSignedUrlData.signedUrl;
            result.thumbnailSignedUrlExpiresAt = thumbnailSignedUrlData.expiresAt;
            result.thumbnailSignedUrlExpiresInMinutes = thumbnailSignedUrlData.expiresInMinutes;
          }
        } catch (error) {
          logger.error('Failed to get thumbnail signed URL:', error);
        }
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to get signed URL:', error);
      res.json({
        success: true,
        data: image.toObject()
      });
    }
  } catch (error) {
    logger.error('Error fetching dataset image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dataset image'
    });
  }
};

// Update image
export const updateImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, tags, metadata } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title?.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (tags) updateData.tags = tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
    if (metadata) updateData.metadata = metadata;

    const image = await DatasetImage.findByIdAndUpdate(id, updateData, { new: true });

    if (!image) {
      res.status(404).json({
        success: false,
        message: 'Dataset image not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Dataset image updated successfully',
      data: image
    });
  } catch (error) {
    logger.error('Error updating dataset image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dataset image'
    });
  }
};

// Delete image
export const deleteImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const image = await DatasetImage.findById(id);
    if (!image) {
      res.status(404).json({
        success: false,
        message: 'Dataset image not found'
      });
      return;
    }

    // Delete files from MinIO (both original and thumbnail if exists)
    try {
      // Delete original file
      await deleteFile(image.minioFileId);
      logger.info(`Deleted original file from MinIO: ${image.minioFileId}`);

      // Delete thumbnail file if it exists
      if (image.minioThumbnailFileId) {
        await deleteFile(image.minioThumbnailFileId);
        logger.info(`Deleted thumbnail file from MinIO: ${image.minioThumbnailFileId}`);
      }
    } catch (error) {
      logger.error(`Failed to delete files for dataset image ${image.minioFileId}:`, error);
      // Continue with database deletion even if MinIO deletion fails
    }

    // Delete the image record from database
    await DatasetImage.findByIdAndDelete(id);

    logger.info(`Dataset image deleted: ${id}`, {
      datasetId: image.datasetId,
      minioFileId: image.minioFileId,
      hadThumbnail: !!image.minioThumbnailFileId
    });

    res.json({
      success: true,
      message: 'Dataset image deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting dataset image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete dataset image'
    });
  }
};

// Get upload signed URL for direct client upload
export const getUploadSignedUrlRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, mimetype, datasetId } = req.body;
    const userId = (req as any).user?.id || 'anonymous'; // Default to 'anonymous' if no user

    logger.info('Getting upload signed URL', { filename, mimetype, datasetId, userId });

    if (!filename || !mimetype || !datasetId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, mimetype, datasetId'
      });
      return;
    }

    // Note: We don't validate dataset existence here since datasetId can be any string identifier
    // (e.g., dataset name like "zod", "waymo", etc.)

    // Generate secure file ID
    const fileId = generateFileId(userId, datasetId, filename, 'vision'); // Using 'vision' as groupId
    logger.info('Generated file ID', { fileId });

    // Get upload URL directly from MinIO
    const uploadUrl = await getUploadSignedUrl(fileId, mimetype, 15);
    logger.info('Generated upload URL successfully');

    res.json({
      success: true,
      data: {
        uploadUrl,
        minioFileId: fileId,
        datasetId,
        expiresInMinutes: 15
      }
    });
  } catch (error) {
    logger.error('Error getting upload signed URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upload signed URL'
    });
  }
};