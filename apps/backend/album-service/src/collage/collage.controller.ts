import { Request, Response } from 'express';
import * as collageService from './collage.service';

/**
 * Create a new collage
 */
export const createCollage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    const collage = await collageService.createCollage(req.body, user.id, userGroups);
    res.status(201).json({
      success: true,
      message: 'Collage created successfully',
      data: collage
    });
  } catch (error: any) {
    console.error('Error creating collage:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('required')
          ? 400
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create collage'
    });
  }
};

/**
 * Update collage
 */
export const updateCollage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;

    const collage = await collageService.updateCollage(id as string, req.body, user.id, userGroups);
    res.json({
      success: true,
      message: 'Collage updated successfully',
      data: collage
    });
  } catch (error: any) {
    console.error('Error updating collage:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message === 'Collage not found'
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update collage'
    });
  }
};

/**
 * Get collage by ID with photos
 */
export const getCollageById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;

    const result = await collageService.getCollageWithPhotos(id as string, user.id, userGroups);

    res.json({
      success: true,
      data: {
        collage: result.collage,
        photos: result.photos
      }
    });
  } catch (error: any) {
    console.error('Error fetching collage:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message === 'Collage not found'
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch collage'
    });
  }
};

/**
 * Get collages list
 */
export const getCollageList = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { albumId, groupId } = req.query;

    const collages = await collageService.getCollageList(
      albumId as string | undefined,
      user.id,
      userGroups,
      groupId as string | undefined
    );

    res.json({
      success: true,
      data: collages
    });
  } catch (error: any) {
    console.error('Error fetching collages:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch collages'
    });
  }
};

/**
 * Delete collage
 */
export const deleteCollage = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;

    await collageService.deleteCollage(id as string, user.id, userGroups);

    res.json({
      success: true,
      message: 'Collage deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting collage:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message === 'Collage not found'
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete collage'
    });
  }
};
