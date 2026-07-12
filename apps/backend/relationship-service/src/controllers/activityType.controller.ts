import { Request, Response } from 'express';
import { NotFoundError, sendSuccess } from '@tumbaland/backend-core';
import * as ActivityTypeService from '../services/activityType.service';

/**
 * Create a new activity type
 */
export const createActivityType = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const typeData: any = {
    ...req.body,
    userId: user.id
  };

  // Generate slug if not provided
  if (!typeData.slug) {
    typeData.slug = typeData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  const activityType = await ActivityTypeService.createActivityType(typeData);
  sendSuccess(res, activityType, 'Activity type created successfully', 201);
};

/**
 * Get all activity types
 */
export const getActivityTypes = async (req: Request, res: Response): Promise<void> => {
  const { isActive, limit, page, groupId } = req.query;
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const filters: any = {};

  if (isActive !== undefined) filters.isActive = isActive === 'true';
  if (limit) filters.limit = parseInt(limit as string) || 50;
  if (page) filters.page = parseInt(page as string) || 1;

  // Handle groupId - check if it was provided in the request
  if (req.query && 'groupId' in req.query) {
    const groupIdValue = groupId as string;
    filters.groupId = groupIdValue === '' || groupIdValue === 'null' ? null : groupIdValue;
  }

  filters.userId = user.id;
  filters.userGroupIds = userGroups;

  const result = await ActivityTypeService.getActivityTypes(filters);

  sendSuccess(res, {
    types: result.types,
    pagination: {
      page: result.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.totalPages
    }
  });
};

/**
 * Get activity type by ID
 */
export const getActivityTypeById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const activityType = await ActivityTypeService.getActivityTypeById(id as string);

  if (!activityType) {
    throw new NotFoundError('Activity type not found');
  }

  sendSuccess(res, activityType);
};

/**
 * Update activity type by ID
 */
export const updateActivityType = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const updateData = req.body;

  const activityType = await ActivityTypeService.updateActivityType(id as string, updateData);

  if (!activityType) {
    throw new NotFoundError('Activity type not found');
  }

  sendSuccess(res, activityType, 'Activity type updated successfully');
};

/**
 * Delete activity type by ID
 */
export const deleteActivityType = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const deleted = await ActivityTypeService.deleteActivityType(id as string);

  if (!deleted) {
    throw new NotFoundError('Activity type not found');
  }

  sendSuccess(res, undefined, 'Activity type deleted successfully');
};

/**
 * Reorder activity types
 */
export const reorderActivityTypes = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { typeIds, groupId } = req.body;

  await ActivityTypeService.reorderActivityTypes(typeIds, user.id, groupId);

  sendSuccess(res, undefined, 'Activity types reordered successfully');
};
