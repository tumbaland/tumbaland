import { Request, Response } from 'express';
import * as collageService from './collage.service';

/**
 * Create a new collage
 */
export const createCollage = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const collage = await collageService.createCollage(req.body, user.id, userGroups);
  res.status(201).json({
    success: true,
    message: 'Collage created successfully',
    data: collage
  });
};

/**
 * Update collage
 */
export const updateCollage = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const collage = await collageService.updateCollage(id as string, req.body, user.id, userGroups);
  res.json({
    success: true,
    message: 'Collage updated successfully',
    data: collage
  });
};

/**
 * Get collage by ID with photos
 */
export const getCollageById = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const result = await collageService.getCollageWithPhotos(id as string, user.id, userGroups);

  res.json({
    success: true,
    data: {
      collage: result.collage,
      photos: result.photos
    }
  });
};

/**
 * Get collages list
 */
export const getCollageList = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
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
};

/**
 * Delete collage
 */
export const deleteCollage = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await collageService.deleteCollage(id as string, user.id, userGroups);

  res.json({
    success: true,
    message: 'Collage deleted successfully'
  });
};
