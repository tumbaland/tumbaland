import { Request, Response } from 'express';
import albumService from '../services/albumService';

/**
 * Create a new album
 */
export const createAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { name, description, isPublic, tags, groupId } = req.body;

    const album = await albumService.createAlbum(
      { name, description, isPublic, tags, groupId },
      user.id
    );

    res.status(201).json({
      success: true,
      message: 'Album created successfully',
      data: album
    });
  } catch (error: any) {
    console.error('Error creating album:', error);
    const statusCode = error.message === 'Album name is required' ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create album'
    });
  }
};

/**
 * Get all albums
 */
export const getAlbums = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const groupServiceError = (req as any).groupServiceError;
    const { page, limit, search, isPublic, groupId, includeCover } = req.query;

    const filter = {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search as string,
      isPublic: isPublic ? isPublic === 'true' : undefined,
      groupId: groupId as string,
      includeCover: includeCover === undefined || includeCover === 'true' || includeCover === '1'
    };

    const result = await albumService.getAlbums(filter, {
      userId: user.id,
      userGroups,
      groupServiceError
    });

    res.json({
      success: true,
      data: {
        albums: result.albums,
        pagination: result.pagination
      }
    });
  } catch (error: any) {
    console.error('Error fetching albums:', error);
    const statusCode = error.message.includes('Access denied') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch albums'
    });
  }
};

/**
 * Get album by ID
 */
export const getAlbumById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;

    const album = await albumService.getAlbumById(id as string, {
      userId: user.id,
      userGroups
    });

    res.json({
      success: true,
      data: album
    });
  } catch (error: any) {
    console.error('Error fetching album:', error);
    const statusCode = error.message === 'Album not found' ? 404 : 
                      error.message === 'Access denied' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch album'
    });
  }
};

/**
 * Update album
 */
export const updateAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;
    const { name, description, isPublic, tags, coverPhotoId, groupId } = req.body;

    const album = await albumService.updateAlbum(
      id as string,
      { name, description, isPublic, tags, coverPhotoId, groupId },
      { userId: user.id, userGroups }
    );

    res.json({
      success: true,
      message: 'Album updated successfully',
      data: album
    });
  } catch (error: any) {
    console.error('Error updating album:', error);
    const statusCode = error.message === 'Album not found' ? 404 :
                      error.message === 'Access denied' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update album'
    });
  }
};

/**
 * Delete album
 */
export const deleteAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await albumService.deleteAlbum(id as string);

    res.json({
      success: true,
      message: 'Album and all photos deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting album:', error);
    const statusCode = error.message === 'Album not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete album'
    });
  }
};

/**
 * Set cover photo for album
 */
export const setCoverPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { photoId } = req.body;

    const album = await albumService.setCoverPhoto(id as string, photoId);

    res.json({
      success: true,
      message: 'Cover photo set successfully',
      data: album
    });
  } catch (error: any) {
    console.error('Error setting cover photo:', error);
    const statusCode = error.message.includes('required') ? 400 :
                      error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to set cover photo'
    });
  }
};

/**
 * Remove cover photo from album
 */
export const removeCoverPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const album = await albumService.removeCoverPhoto(id as string);

    res.json({
      success: true,
      message: 'Cover photo removed successfully',
      data: album
    });
  } catch (error: any) {
    console.error('Error removing cover photo:', error);
    const statusCode = error.message === 'Album not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to remove cover photo'
    });
  }
};
