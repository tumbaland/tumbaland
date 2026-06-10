import { Request, Response } from 'express';
import * as ActivityService from '../services/activity.service';
import { IActivity } from '../models/Activity';

/**
 * Create a new activity
 */
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const activityData: Partial<IActivity> = {
      ...req.body,
      userId: user.id
    };

    // Validate required fields
    if (!activityData.date || !activityData.activity) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: date and activity are required'
      });
      return;
    }

    // Validate activity object structure
    if (!activityData.activity.typeId) {
      res.status(400).json({
        success: false,
        message: 'Activity object must contain typeId'
      });
      return;
    }

    // Validate that the activity type exists and is accessible
    const ActivityType = (await import('../models/ActivityType')).ActivityType;
    const activityType = await ActivityType.findOne({
      _id: activityData.activity.typeId,
      isActive: true,
      $or: [
        { userId: user.id },
        { groupId: { $in: (req as any).userGroups || [] } }
      ]
    });

    if (!activityType) {
      res.status(400).json({
        success: false,
        message: 'Invalid or inaccessible activity type'
      });
      return;
    }

    // Validate hours if provided (must be non-negative)
    if (activityData.hours !== undefined && activityData.hours < 0) {
      res.status(400).json({
        success: false,
        message: 'Hours must be a non-negative number'
      });
      return;
    }

    const activity = await ActivityService.createActivity(activityData);
    res.status(201).json({
      success: true,
      message: 'Activity created successfully',
      data: activity
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create activity'
    });
  }
};

/**
 * Get all activities with filters
 */
export const getActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { activityType, startDate, endDate, description, limit, page, sortBy, sortOrder, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    const filters: any = {};
    if (activityType) filters.activityType = activityType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (description) filters.description = description as string;
    if (limit) filters.limit = parseInt(limit as string) || 20;
    if (page) filters.page = parseInt(page as string) || 1;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as 'asc' | 'desc';
    if (groupId) filters.groupId = groupId as string;
    
    filters.userId = user.id;
    filters.userGroupIds = userGroups;

    const result = await ActivityService.getActivities(filters);

    res.json({
      success: true,
      data: {
        activities: result.activities,
        pagination: {
          page: result.page,
          limit: filters.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      }
    });
  } catch (error: any) {
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch activities'
    });
  }
};

/**
 * Get activity by ID
 */
export const getActivityById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const activity = await ActivityService.getActivityById(id as string);

    if (!activity) {
      res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
      return;
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity'
    });
  }
};

/**
 * Update activity by ID
 */
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const activity = await ActivityService.updateActivity(id as string, updateData);

    if (!activity) {
      res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Activity updated successfully',
      data: activity
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update activity'
    });
  }
};

/**
 * Delete activity by ID
 */
export const deleteActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await ActivityService.deleteActivity(id as string);

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Activity not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete activity'
    });
  }
};

/**
 * Get activity statistics
 */
export const getActivityStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    const filters: any = {};
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const stats = await ActivityService.getActivityStats(filters);

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch statistics'
    });
  }
};

/**
 * Get activities by date range
 */
export const getActivitiesByDateRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required'
      });
      return;
    }

    const activities = await ActivityService.getActivitiesByDateRange(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: activities
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch activities by date range'
    });
  }
};

/**
 * Get recent activities
 */
export const getRecentActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const limitNum = limit ? parseInt(limit as string) : 10;

    const filters = {
      limit: limitNum,
      page: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc' as 'desc',
      userId: user.id,
      userGroupIds: userGroups
    };

    const result = await ActivityService.getActivities(filters);

    res.json({
      success: true,
      data: result.activities
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch recent activities'
    });
  }
};

/**
 * Get activity types
 */
export const getActivityTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { groupId } = req.query;

    const types = await ActivityService.getActivityTypes(user.id, groupId as string, userGroups);

    res.json({
      success: true,
      data: types
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activity types'
    });
  }
};

/**
 * Get recent activities summary by category and timeline
 */
export const getRecentActivitiesSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    const activityTypes = await ActivityService.getActivityTypes(user.id, groupId as string, userGroups);
    const categories = activityTypes.map((type: any) => type.slug);

    const timelines = [
      { label: 'Last Month', months: 1 },
      { label: 'Last 3 Months', months: 3 },
      { label: 'Last Year', months: 12 }
    ];

    const result: Record<string, any> = {};

    for (const category of categories) {
      result[category] = {};

      for (const timeline of timelines) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - timeline.months);

        const filters: any = {
          startDate,
          endDate,
          activityType: category,
          limit: 1000,
          page: 1,
          sortBy: 'date',
          sortOrder: 'asc' as 'asc',
          userId: user.id,
          userGroupIds: userGroups
        };

        if (groupId) {
          filters.groupId = groupId as string;
        }

        const activitiesResult = await ActivityService.getActivities(filters);
        const activities = activitiesResult.activities;

        result[category][`${timeline.months}months`] = {
          label: timeline.label,
          activities: activities
        };
      }
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch activities summary'
    });
  }
};

/**
 * Get all unique descriptions for a given activity type
 */
export const getActivityDescriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { typeId, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    if (!typeId) {
      res.status(400).json({ success: false, message: 'typeId is required' });
      return;
    }

    const descriptions = await ActivityService.getDescriptionsByTypeId(
      typeId as string,
      user.id,
      userGroups,
      groupId as string | undefined
    );

    res.json({ success: true, data: descriptions });
  } catch (error: any) {
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({ success: false, message: error.message || 'Failed to fetch descriptions' });
  }
};
