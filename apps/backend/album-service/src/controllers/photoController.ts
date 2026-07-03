import { Request, Response } from 'express';
import { BadRequestError, NotFoundError, UnauthorizedError } from '@tumbaland/core';
import photoService from '../services/photoService';
import { getUploadSignedUrl, generateFileId } from '../services/fileServiceClient';
import Album from '../models/Album';

/**
 * Create a new photo record
 */
export const createPhoto = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const album = await Album.findById(req.body.albumId);

  const photo = await photoService.createPhoto(req.body, user.id, album?.groupId);

  res.status(201).json({
    success: true,
    message: 'Photo created successfully',
    data: photo
  });
};

/**
 * Get photos by album
 */
export const getPhotosByAlbum = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Get photo by ID
 */
export const getPhotoById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const photo = await photoService.getPhotoById(id as string);

  res.json({
    success: true,
    data: photo
  });
};

/**
 * Update photo metadata
 */
export const updatePhoto = async (req: Request, res: Response): Promise<void> => {
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
};

/**
 * Delete photo
 */
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await photoService.deletePhoto(id as string);

  res.json({
    success: true,
    message: 'Photo deleted successfully'
  });
};

/**
 * Get upload signed URL for direct client upload
 */
export const getUploadSignedUrlRequest = async (req: Request, res: Response): Promise<void> => {
  const { filename, mimetype, albumId } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    throw new UnauthorizedError('Access token required');
  }

  if (!filename || !mimetype || !albumId) {
    throw new BadRequestError('Missing required fields: filename, mimetype, albumId');
  }

  // Check if album exists
  const album = await Album.findById(albumId);
  if (!album) {
    throw new NotFoundError('Album not found');
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
};

/**
 * Update photo with AI analysis results
 */
export const updatePhotoAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { objectDetection, segmentation } = req.body;

  if (!objectDetection && !segmentation) {
    throw new BadRequestError('Must provide objectDetection or segmentation data');
  }

  const photo = await photoService.updatePhotoAIAnalysis(id as string, {
    objectDetection,
    segmentation
  });

  res.json({
    success: true,
    data: photo
  });
};

/**
 * Get photos that need AI analysis
 */
export const getPhotosForAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  const { albumId } = req.params;
  const { limit = 50 } = req.query;

  const photos = await photoService.getPhotosForAIAnalysis(albumId as string, Number(limit));

  res.json({
    success: true,
    data: photos
  });
};

/**
 * Get photo by minioFileId (for file service integration)
 */
export const getPhotoByFileId = async (req: Request, res: Response): Promise<void> => {
  const { fileId } = req.params;

  const photo = await photoService.getPhotoByFileId(fileId as string);

  res.json({
    success: true,
    data: photo
  });
};
