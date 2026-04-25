import { Request, Response } from 'express';
import photoService from '../services/photoService';
import { getUploadSignedUrl, generateFileId } from '../services/fileServiceClient';
import Album from '../models/Album';

/**
 * Create a new photo record
 */
export const createPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const album = await Album.findById(req.body.albumId);

    const photo = await photoService.createPhoto(req.body, user.id, album?.groupId);

    res.status(201).json({
      success: true,
      message: 'Photo created successfully',
      data: photo
    });
  } catch (error: any) {
    console.error('Error creating photo:', error);
    const statusCode = error.message.includes('Missing required') ? 400 :
                      error.message === 'Album not found' ? 404 :
                      error.message.includes('already exists') ? 409 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create photo'
    });
  }
};

/**
 * Get photos by album
 */
export const getPhotosByAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { albumId } = req.params;
    const { page, limit, search } = req.query;

    const result = await photoService.getPhotosByAlbum(albumId as string, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : undefined,
      search: search as string
    });

    res.json({
      success: true,
      data: {
        photos: result.photos,
        pagination: result.pagination
      }
    });
  } catch (error: any) {
    console.error('Error fetching photos:', error);
    const statusCode = error.message === 'Album not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch photos'
    });
  }
};

/**
 * Get photo by ID
 */
export const getPhotoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const photo = await photoService.getPhotoById(id as string);

    res.json({
      success: true,
      data: photo
    });
  } catch (error: any) {
    console.error('Error fetching photo:', error);
    const statusCode = error.message === 'Photo not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch photo'
    });
  }
};

/**
 * Update photo metadata
 */
export const updatePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, tags, metadata } = req.body;

    const photo = await photoService.updatePhoto(id as string, {
      title,
      description,
      tags,
      metadata
    });

    res.json({
      success: true,
      message: 'Photo updated successfully',
      data: photo
    });
  } catch (error: any) {
    console.error('Error updating photo:', error);
    const statusCode = error.message === 'Photo not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update photo'
    });
  }
};

/**
 * Delete photo
 */
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await photoService.deletePhoto(id as string);

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting photo:', error);
    const statusCode = error.message === 'Photo not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete photo'
    });
  }
};

/**
 * Get upload signed URL for direct client upload
 */
export const getUploadSignedUrlRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, mimetype, albumId } = req.body;
    const userId = (req as any).user?.id;

    if (!filename || !mimetype || !albumId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, mimetype, albumId'
      });
      return;
    }

    // Check if album exists
    const album = await Album.findById(albumId);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Generate secure file ID (user-scoped for organization)
    const fileId = generateFileId(userId, albumId, filename, album.groupId);

    // Get upload URL directly from file service
    const uploadUrl = await getUploadSignedUrl(fileId, mimetype, 15);

    res.json({
      success: true,
      data: {
        uploadUrl,
        minioFileId: fileId,
        albumId,
        expiresInMinutes: 15
      }
    });
  } catch (error: any) {
    console.error('Error getting upload signed URL:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get upload signed URL'
    });
  }
};

/**
 * Update photo with AI analysis results
 */
export const updatePhotoAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { objectDetection, segmentation } = req.body;

    // Basic validation
    if (!objectDetection && !segmentation) {
      res.status(400).json({
        success: false,
        message: 'Must provide objectDetection or segmentation data'
      });
      return;
    }

    const photo = await photoService.updatePhotoAIAnalysis(id as string, {
      objectDetection,
      segmentation
    });

    res.json({
      success: true,
      data: photo
    });
  } catch (error: any) {
    console.error('Error updating photo AI analysis:', error);
    const statusCode = error.message === 'Photo not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update photo AI analysis'
    });
  }
};

/**
 * Get photos that need AI analysis
 */
export const getPhotosForAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { albumId } = req.params;
    const { limit = 50 } = req.query;

    const photos = await photoService.getPhotosForAIAnalysis(albumId as string, Number(limit));

    res.json({
      success: true,
      data: photos
    });
  } catch (error: any) {
    console.error('Error getting photos for AI analysis:', error);
    const statusCode = error.message === 'Album not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to get photos for AI analysis'
    });
  }
};

/**
 * Get photo by minioFileId (for file service integration)
 */
export const getPhotoByFileId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;

    const photo = await photoService.getPhotoByFileId(fileId as string);

    res.json({
      success: true,
      data: photo
    });
  } catch (error: any) {
    console.error('Error fetching photo by minioFileId:', error);
    const statusCode = error.message === 'Photo not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch photo'
    });
  }
};
