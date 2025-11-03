import { Request, Response } from 'express';
import mongoose from 'mongoose';
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

// Get all images
export const getAllImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit, search, tags } = req.query;

    const query: any = {};
    if (search) {
      query.$text = { $search: search as string };
    }
    if (tags) {
      const tagsArray = (tags as string).split(' ').map(tag => tag.trim()).filter(tag => tag.length > 0);
      if (tagsArray.length > 0) {
        query.tags = { $in: tagsArray };
      }
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
    logger.error('Error fetching all images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch images'
    });
  }
};

export const createDatasetImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      filename,
      originalName,
      minioFileId,
      datasetId,
      categoryId,
      title,
      description,
      mimetype,
      size,
      width,
      height,
      tags = [],
      labels = [],
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!filename || !originalName || !minioFileId || !datasetId || !categoryId || !mimetype || !size) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, originalName, minioFileId, datasetId, categoryId, mimetype, size'
      });
      return;
    }

    // Validate category exists
    const ImageCategory = require('../models/ImageCategory').default;
    const category = await ImageCategory.findById(categoryId);
    if (!category) {
      res.status(400).json({
        success: false,
        message: 'Invalid categoryId. Category does not exist.'
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
      categoryId,
      title: title?.trim(),
      description: description?.trim(),
      mimetype,
      size,
      width,
      height,
      tags: tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0),
      labels: labels.map((label: string) => label.trim()).filter((label: string) => label.length > 0),
      metadata
    });

    const savedImage = await image.save();

    logger.info(`Dataset image created: ${savedImage._id}`, {
      datasetId,
      categoryId,
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
    const { page = 1, limit, search, categoryId, tags } = req.query;

    // First, find the dataset by uuid, name, or ObjectId
    const dataset = await Dataset.findOne({
      $or: [
        { uuid: datasetId },
        { name: datasetId },
        { _id: mongoose.Types.ObjectId.isValid(datasetId) ? datasetId : null }
      ].filter(condition => condition !== null)
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: `Dataset '${datasetId}' not found`
      });
      return;
    }

    const query: any = { datasetId: dataset._id };
    if (search) {
      query.$text = { $search: search as string };
    }
    if (categoryId) {
      query.categoryId = categoryId;
    }
    if (tags) {
      const tagsArray = (tags as string).split(' ').map(tag => tag.trim()).filter(tag => tag.length > 0);
      if (tagsArray.length > 0) {
        query.tags = { $in: tagsArray };
      }
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

// Get images by dataset and category
export const getImagesByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { datasetId, categoryId } = req.params;
    const { page = 1, limit, search, labels } = req.query;

    // First, find the dataset by uuid, name, or ObjectId
    const dataset = await Dataset.findOne({
      $or: [
        { uuid: datasetId },
        { name: datasetId },
        { _id: mongoose.Types.ObjectId.isValid(datasetId) ? datasetId : null }
      ].filter(condition => condition !== null)
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: `Dataset '${datasetId}' not found`
      });
      return;
    }

    const query: any = { datasetId: dataset._id, categoryId };
    if (search) {
      query.$text = { $search: search as string };
    }
    if (labels) {
      const labelsArray = (labels as string).split(',').map(label => label.trim());
      query.labels = { $in: labelsArray };
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
    logger.error('Error fetching dataset images by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dataset images by category'
    });
  }
};

// Get image labels statistics for a dataset
export const getImageLabelsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { datasetId } = req.params;

    // First, find the dataset by uuid, name, or ObjectId
    const dataset = await Dataset.findOne({
      $or: [
        { uuid: datasetId },
        { name: datasetId },
        { _id: mongoose.Types.ObjectId.isValid(datasetId) ? datasetId : null }
      ].filter(condition => condition !== null)
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: `Dataset '${datasetId}' not found`
      });
      return;
    }

    const stats = await DatasetImage.aggregate([
      { $match: { datasetId: dataset._id } },
      { $unwind: '$labels' },
      { $group: { _id: '$labels', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching image labels statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch image labels statistics'
    });
  }
};

// Export images by labels to CSV
export const exportImagesByLabels = async (req: Request, res: Response): Promise<void> => {
  try {
    const { datasetId } = req.params;
    const { labels } = req.query;

    if (!labels) {
      res.status(400).json({
        success: false,
        message: 'Labels parameter is required'
      });
      return;
    }

    // First, find the dataset by uuid, name, or ObjectId
    const dataset = await Dataset.findOne({
      $or: [
        { uuid: datasetId },
        { name: datasetId },
        { _id: mongoose.Types.ObjectId.isValid(datasetId) ? datasetId : null }
      ].filter(condition => condition !== null)
    });

    if (!dataset) {
      res.status(404).json({
        success: false,
        message: `Dataset '${datasetId}' not found`
      });
      return;
    }

    const labelsArray = (labels as string).split(',').map(label => label.trim());
    const query = { datasetId: dataset._id, labels: { $in: labelsArray } };

    const images = await DatasetImage.find(query).populate('categoryId').sort({ createdAt: -1 });

    // Set CSV headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="images_${labelsArray.join('_')}_${Date.now()}.csv"`);

    // CSV header
    let csv = 'ID,Filename,Original Name,Category Name,Labels,Tags,Size,Width,Height,Created At\n';

    // Add data rows
    images.forEach((image) => {
      const labelsStr = image.labels.join(';');
      const tagsStr = image.tags.join(';');
      const categoryName = (image as any).categoryId?.name || 'Unknown';
      csv += `"${image._id}","${image.filename}","${image.originalName}","${categoryName}","${labelsStr}","${tagsStr}",${image.size},${image.width || ''},${image.height || ''},"${image.createdAt}"\n`;
    });

    res.send(csv);
  } catch (error) {
    logger.error('Error exporting images to CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export images to CSV'
    });
  }
};
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
    const { title, description, tags, labels, categoryId, metadata } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title?.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (tags) updateData.tags = tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
    if (labels) updateData.labels = labels.map((label: string) => label.trim()).filter((label: string) => label.length > 0);
    if (categoryId !== undefined) updateData.categoryId = categoryId || null; // Allow null to remove category
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
    const { filename, mimetype, datasetId, categoryId } = req.body;
    const userId = (req as any).user?.id || 'anonymous'; // Default to 'anonymous' if no user

    logger.info('Getting upload signed URL', { filename, mimetype, datasetId, categoryId, userId });

    if (!filename || !mimetype || !datasetId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, mimetype, datasetId'
      });
      return;
    }

    // Validate category exists if provided
    if (categoryId) {
      const ImageCategory = require('../models/ImageCategory').default;
      const category = await ImageCategory.findById(categoryId);
      if (!category) {
        res.status(400).json({
          success: false,
          message: 'Invalid categoryId. Category does not exist.'
        });
        return;
      }
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
        categoryId,
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