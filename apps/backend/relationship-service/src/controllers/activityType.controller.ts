import { Request, Response } from 'express';
import * as ActivityTypeService from '../services/activityType.service';

/**
 * Create a new activity type
 */
export const createActivityType = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const typeData: any = {
      ...req.body,
      userId: user.id
    };

    // Validate required fields
    if (!typeData.name) {
      res.status(400).json({
        success: false,
        message: 'Missing required field: name is required'
      });
      return;
    }

    // Generate slug if not provided
    if (!typeData.slug) {
      typeData.slug = typeData.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }

    const activityType = await ActivityTypeService.createActivityType(typeData);
    res.status(201).json({
      success: true,
      message: 'Activity type created successfully',
      data: activityType
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create activity type'
    });
  }
};

/**
 * Get all activity types
 */
export const getActivityTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isActive, limit, page, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

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

    res.json({
      success: true,
      data: {
        types: result.types,
        pagination: {
          page: result.page,
          limit: filters.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity types'
    });
  }
};

/**
 * Get activity type by ID
 */
export const getActivityTypeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const activityType = await ActivityTypeService.getActivityTypeById(id as string);

    if (!activityType) {
      res.status(404).json({
        success: false,
        message: 'Activity type not found'
      });
      return;
    }

    res.json({
      success: true,
      data: activityType
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity type'
    });
  }
};

/**
 * Update activity type by ID
 */
export const updateActivityType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const activityType = await ActivityTypeService.updateActivityType(id as string, updateData);

    if (!activityType) {
      res.status(404).json({
        success: false,
        message: 'Activity type not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Activity type updated successfully',
      data: activityType
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update activity type'
    });
  }
};

/**
 * Delete activity type by ID
 */
export const deleteActivityType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await ActivityTypeService.deleteActivityType(id as string);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Activity type not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Activity type deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete activity type'
    });
  }
};

/**
 * Reorder activity types
 */
export const reorderActivityTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { typeIds, groupId } = req.body;

    if (!Array.isArray(typeIds)) {
      res.status(400).json({
        success: false,
        message: 'typeIds must be an array'
      });
      return;
    }

    await ActivityTypeService.reorderActivityTypes(typeIds, user.id, groupId);

    res.json({
      success: true,
      message: 'Activity types reordered successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reorder activity types'
    });
  }
};