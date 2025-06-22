import { Request, Response } from 'express';
import * as ActivityService from '../services/activity.service';
import { IActivity } from '../models/Activity';

// Create a new activity
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const activityData: Partial<IActivity> = req.body;
    
    // Validate required fields
    if (!activityData.date || !activityData.activity) {
      res.status(400).json({
        error: 'Missing required fields: date and activity are required'
      });
      return;
    }

    // Validate activity object structure
    if (!activityData.activity.type) {
      res.status(400).json({
        error: 'Activity object must contain type'
      });
      return;
    }

    // Validate hours if provided (must be non-negative)
    if (activityData.hours !== undefined && activityData.hours < 0) {
      res.status(400).json({
        error: 'Hours must be a non-negative number'
      });
      return;
    }

    const activity = await ActivityService.createActivity(activityData);
    res.status(201).json({
      success: true,
      data: activity
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message
    });
  }
};

// Get all activities with filters
export const getActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      activityType,
      startDate,
      endDate,
      limit,
      page,
      sortBy,
      sortOrder
    } = req.query;

    const filters: any = {};
    
    if (activityType) filters.activityType = activityType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (limit) filters.limit = parseInt(limit as string) || 20;
    if (page) filters.page = parseInt(page as string) || 1;
    if (sortBy) filters.sortBy = sortBy as string;
    if (sortOrder) filters.sortOrder = sortOrder as 'asc' | 'desc';

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
    res.status(500).json({
      error: error.message
    });
  }
};

// Get activity by ID
export const getActivityById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const activity = await ActivityService.getActivityById(id);
    
    if (!activity) {
      res.status(404).json({
        error: 'Activity not found'
      });
      return;
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Update activity by ID
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const activity = await ActivityService.updateActivity(id, updateData);
    
    if (!activity) {
      res.status(404).json({
        error: 'Activity not found'
      });
      return;
    }

    res.json({
      success: true,
      data: activity
    });
  } catch (error: any) {
    res.status(400).json({
      error: error.message
    });
  }
};

// Delete activity by ID
export const deleteActivity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await ActivityService.deleteActivity(id);
    
    if (!deleted) {
      res.status(404).json({
        error: 'Activity not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Activity deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Get activity statistics
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
      error: error.message
    });
  }
};

// Get activities by date range
export const getActivitiesByDateRange = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({
        error: 'Both startDate and endDate are required'
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
      error: error.message
    });
  }
};

// Get recent activities
export const getRecentActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : 10;
    
    const activities = await ActivityService.getRecentActivities(limitNum);
    
    res.json({
      success: true,
      data: activities
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};

// Get activity types
export const getActivityTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const types = await ActivityService.getActivityTypes();
    
    res.json({
      success: true,
      data: types
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message
    });
  }
};
