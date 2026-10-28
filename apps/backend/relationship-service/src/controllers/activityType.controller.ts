import { Request, Response } from 'express';
import { NotFoundError, canAccessResource, sendSuccess, assertMemberOf } from '@tumbaland/backend-core';
import * as ActivityTypeService from '../services/activityType.service';
import { IActivityType } from '../models/ActivityType';
import { createActivityTypeSchema } from '../validation/schemas';
import { z } from 'zod';

/**
 * The type, if the caller may reach it: their own personal type or one in a
 * group they belong to. Anything else answers as missing, so ids cannot be
 * probed. Every by-id route goes through this; before it, any signed-in caller
 * could read, rename or delete another account's type by naming its id.
 */
const findReachable = async (req: Request, id: string): Promise<IActivityType> => {
  const type = await ActivityTypeService.getActivityTypeById(id);
  if (!type || !canAccessResource(req.user!.id, type.userId, type.groupId, req.userGroups || [])) {
    throw new NotFoundError('Activity type not found');
  }
  return type;
};

/** Refuses a write that would put a type into a group the caller is not in. */
const assertGroupMember = (req: Request, groupId?: string | null): void => {
  assertMemberOf(groupId, req.userGroups);
};

/**
 * Create a new activity type
 */
export const createActivityType = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const body = req.body as z.infer<typeof createActivityTypeSchema>;
  assertGroupMember(req, body.groupId);
  const typeData: Partial<IActivityType> = {
    ...body,
    userId: user.id
  };

  // Generate slug if not provided
  if (!typeData.slug) {
    typeData.slug = body.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
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

  const filters: {
    userId?: string;
    groupId?: string | null;
    isActive?: boolean;
    limit?: number;
    page?: number;
    userGroupIds?: string[];
  } = {};

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
  const activityType = await findReachable(req, id as string);

  sendSuccess(res, activityType);
};

/**
 * Update activity type by ID
 */
export const updateActivityType = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const updateData = req.body;

  await findReachable(req, id as string);
  assertGroupMember(req, updateData.groupId);

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
  await findReachable(req, id as string);
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
