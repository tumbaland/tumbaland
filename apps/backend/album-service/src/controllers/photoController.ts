import { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError, sendSuccess } from '@tumbaland/core';
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

  sendSuccess(res, photo, 'Photo created successfully', 201);
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

  sendSuccess(res, { photos: result.photos, pagination: result.pagination });
};

/**
 * Get photo by ID
 */
export const getPhotoById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const photo = await photoService.getPhotoById(id as string);

  sendSuccess(res, photo);
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

  sendSuccess(res, photo, 'Photo updated successfully');
};

/**
 * Delete photo
 */
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  await photoService.deletePhoto(id as string);

  sendSuccess(res, undefined, 'Photo deleted successfully');
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

  // Check if album exists
  const album = await Album.findById(albumId);
  if (!album) {
    throw new NotFoundError('Album not found');
  }

  // Generate secure file ID (user-scoped for organization)
  const fileId = generateFileId(userId, albumId, filename, album.groupId);

  // Get upload URL directly from file service
  const uploadUrl = await getUploadSignedUrl(fileId, mimetype, 15);

  sendSuccess(res, { uploadUrl, minioFileId: fileId, albumId, expiresInMinutes: 15 });
};

/**
 * Update photo with AI analysis results
 */
export const updatePhotoAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { objectDetection, segmentation } = req.body;

  const photo = await photoService.updatePhotoAIAnalysis(id as string, {
    objectDetection,
    segmentation
  });

  sendSuccess(res, photo);
};

/**
 * Get photos that need AI analysis
 */
export const getPhotosForAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  const { albumId } = req.params;
  const { limit = 50 } = req.query;

  const photos = await photoService.getPhotosForAIAnalysis(albumId as string, Number(limit));

  sendSuccess(res, photos);
};

/**
 * Get photo by minioFileId (for file service integration)
 */
export const getPhotoByFileId = async (req: Request, res: Response): Promise<void> => {
  const { fileId } = req.params;

  const photo = await photoService.getPhotoByFileId(fileId as string);

  sendSuccess(res, photo);
};
