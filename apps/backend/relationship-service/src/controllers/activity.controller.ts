import { Request, Response } from 'express';
import { BadRequestError, NotFoundError, countRead, sendSuccess } from '@tumbaland/backend-core';
import * as ActivityService from '../services/activity.service';
import { IActivity } from '../models/Activity';

/**
 * Create a new activity
 */
export const createActivity = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const activityData: Partial<IActivity> = {
    ...req.body,
    userId: user.id
  };

  // Validate that the activity type exists and is accessible in the scope the
  // entry is being written into — a group entry needs one of that group's types
  // (route-level schema validation already guarantees typeId is present)
  const accessible = await ActivityService.isTypeAccessible(
    String(activityData.typeId),
    user.id,
    req.userGroups || [],
    activityData.groupId
  );

  if (!accessible) {
    throw new BadRequestError('Invalid or inaccessible activity type');
  }

  const activity = await ActivityService.createActivity(activityData);
  sendSuccess(res, activity, 'Activity created successfully', 201);
};

/**
 * Get all activities with filters
 */
export const getActivities = async (req: Request, res: Response): Promise<void> => {
  const { activityType, startDate, endDate, description, limit, page, sortBy, sortOrder, groupId } = req.query;
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const filters: Parameters<typeof ActivityService.getActivities>[0] = {};
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

  // How much left the server, not just that something did: "read the journal"
  // and "read four hundred entries" are different events in a trail.
  countRead(res, result.activities.length);

  sendSuccess(res, {
    activities: result.activities,
    pagination: {
      page: result.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.totalPages
    }
  });
};

/**
 * Get activity by ID
 */
export const getActivityById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const activity = await ActivityService.getActivityById(id as string, user.id, req.userGroups || []);

  if (!activity) {
    throw new NotFoundError('Activity not found');
  }

  sendSuccess(res, activity);
};

/**
 * Update activity by ID
 */
export const updateActivity = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const updateData = req.body;

  // An edit may move an entry to a different type, and that type has to pass
  // the same test the create path applies — otherwise the check there is only
  // as strong as the absence of an edit endpoint. The scope is the one the
  // entry ends up in: the update's groupId where it sets one, else the stored.
  if (updateData.typeId !== undefined) {
    const current = await ActivityService.getActivityById(id as string, user.id, userGroups);
    if (!current) {
      throw new NotFoundError('Activity not found');
    }
    const accessible = await ActivityService.isTypeAccessible(
      String(updateData.typeId),
      user.id,
      userGroups,
      updateData.groupId ?? current.groupId
    );
    if (!accessible) {
      throw new BadRequestError('Invalid or inaccessible activity type');
    }
  }

  const activity = await ActivityService.updateActivity(id as string, updateData, user.id, userGroups);

  if (!activity) {
    throw new NotFoundError('Activity not found');
  }

  sendSuccess(res, activity, 'Activity updated successfully');
};

/**
 * Delete activity by ID
 */
export const deleteActivity = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user!;
  const deleted = await ActivityService.deleteActivity(id as string, user.id, req.userGroups || []);

  if (!deleted) {
    throw new NotFoundError('Activity not found');
  }

  sendSuccess(res, undefined, 'Activity deleted successfully');
};

/**
 * Get recent activities
 */
export const getRecentActivities = async (req: Request, res: Response): Promise<void> => {
  const { limit } = req.query;
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const limitNum = limit ? parseInt(limit as string) : 10;

  const filters = {
    limit: limitNum,
    page: 1,
    sortBy: 'createdAt',
    sortOrder: 'desc' as const,
    userId: user.id,
    userGroupIds: userGroups
  };

  const result = await ActivityService.getActivities(filters);

  sendSuccess(res, result.activities);
};

/**
 * Get activity types
 */
export const getActivityTypes = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  const types = await ActivityService.getActivityTypes(user.id, groupId as string, userGroups);

  sendSuccess(res, types);
};

/**
 * Get recent activities summary by category and timeline
 */
export const getRecentActivitiesSummary = async (req: Request, res: Response): Promise<void> => {
  const { groupId } = req.query;
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const activityTypes = await ActivityService.getActivityTypes(user.id, groupId as string, userGroups);
  const categories = activityTypes.map((type) => type.slug);

  const timelines = [
    { label: 'Last Month', months: 1 },
    { label: 'Last 3 Months', months: 3 },
    { label: 'Last Year', months: 12 }
  ];

  const result: Record<string, Record<string, { label: string; activities: IActivity[] }>> = {};

  for (const category of categories) {
    result[category] = {};

    for (const timeline of timelines) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - timeline.months);

      const filters: Parameters<typeof ActivityService.getActivities>[0] = {
        startDate,
        endDate,
        activityType: category,
        limit: 1000,
        page: 1,
        sortBy: 'date',
        sortOrder: 'asc' as const,
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

  sendSuccess(res, result);
};

/**
 * Get all unique descriptions for a given activity type
 */
export const getActivityDescriptions = async (req: Request, res: Response): Promise<void> => {
  const { typeId, groupId } = req.query;
  const user = req.user!;
  const userGroups = req.userGroups || [];

  if (!typeId) {
    throw new BadRequestError('typeId is required');
  }

  const descriptions = await ActivityService.getDescriptionsByTypeId(
    typeId as string,
    user.id,
    userGroups,
    groupId as string | undefined
  );

  sendSuccess(res, descriptions);
};
