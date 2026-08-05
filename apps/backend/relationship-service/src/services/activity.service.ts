import mongoose from 'mongoose';
import { ForbiddenError } from '@tumbaland/backend-core';
import { Activity, IActivity } from '../models/Activity';
import { IActivityType } from '../models/ActivityType';

interface ActivityQuery {
  typeId?: mongoose.Types.ObjectId;
  date?: { $gte?: Date; $lte?: Date };
  description?: Record<string, unknown>;
  groupId?: string | null;
  userId?: string;
  $or?: Record<string, unknown>[];
}

interface ActivityTypeQuery {
  isActive?: boolean;
  userId?: string;
  $or?: Record<string, unknown>[];
}

// Create a new activity
export const createActivity = async (activityData: Partial<IActivity>): Promise<IActivity> => {
  const activity = new Activity(activityData);
  return activity.save();
};

// Get all activities with optional filters
export const getActivities = async (
  filters: {
    activityType?: string;
    startDate?: Date;
    endDate?: Date;
    description?: string;
    limit?: number;
    page?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    groupId?: string;
    userId?: string;
    userGroupIds?: string[];
  } = {}
): Promise<{ activities: IActivity[]; total: number; page: number; totalPages: number }> => {
  const {
    activityType,
    startDate,
    endDate,
    description,
    limit = 20,
    page = 1,
    sortBy = 'date',
    sortOrder = 'asc',
    groupId,
    userId,
    userGroupIds = []
  } = filters;

  // Build base query
  const query: ActivityQuery = {};

  if (activityType) {
    // Find the activity type by slug and get its ID
    const ActivityType = (await import('../models/ActivityType')).ActivityType;
    const typeDoc = await ActivityType.findOne({ slug: activityType, isActive: true });
    if (typeDoc) {
      query.typeId = typeDoc._id;
    } else {
      // If type not found, return empty results
      return {
        activities: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }

  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = startDate;
    if (endDate) query.date.$lte = endDate;
  }

  if (description) {
    query.description = { $regex: description, $options: 'i' };
  }

  // Apply permission filtering
  if (groupId) {
    // Check if user has access to the specific group
    if (!userGroupIds.includes(groupId)) {
      throw new ForbiddenError('Access denied');
    }
    query.groupId = groupId;
  } else if (userId) {
    // Personal context - show only items without groupId (personal items only)
    query.userId = userId;
    query.$or = [
      { groupId: { $exists: false } },
      { groupId: null }
    ];
  }

  // Build sort object
  const sortObj: Record<string, 1 | -1> = {};
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  // Map frontend sort fields to database fields
  switch (sortBy) {
    case 'date':
      sortObj.date = sortDirection;
      break;
    case 'hours':
      sortObj.hours = sortDirection;
      break;
    case 'description':
      sortObj.description = sortDirection;
      break;
    case 'createdAt':
      sortObj.createdAt = sortDirection;
      break;
    default:
      sortObj.date = -1; // Default to date descending
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute queries
  const [activities, total] = await Promise.all([
    Activity.find(query).populate('typeId').sort(sortObj).skip(skip).limit(limit),
    Activity.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    activities,
    total,
    page,
    totalPages
  };
};

// Get activity by ID
export const getActivityById = async (id: string): Promise<IActivity | null> => {
  return Activity.findById(id);
};

// Update activity by ID
export const updateActivity = async (id: string, updateData: Partial<IActivity>): Promise<IActivity | null> => {
  return Activity.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

// Delete activity by ID
export const deleteActivity = async (id: string): Promise<boolean> => {
  const result = await Activity.findByIdAndDelete(id);
  return !!result;
};

// Get unique activity types
export const getActivityTypes = async (userId?: string, groupId?: string, userGroupIds: string[] = []): Promise<IActivityType[]> => {
  const ActivityType = (await import('../models/ActivityType')).ActivityType;
  const query: ActivityTypeQuery = { isActive: true };

  if (groupId) {
    // Check if user has access to the specific group
    if (!userGroupIds.includes(groupId)) {
      throw new ForbiddenError('Access denied');
    }
    query.$or = [
      { groupId },
      { userId, groupId: { $exists: false } }
    ];
  } else if (userId) {
    query.userId = userId;
    query.$or = [
      { groupId: { $exists: false } },
      { groupId: null }
    ];
  }

  return ActivityType.find(query).sort({ sortOrder: 1 });
};

// Get all unique descriptions for a given activity type (for Autocomplete)
export const getDescriptionsByTypeId = async (
  typeId: string,
  userId: string,
  userGroupIds: string[],
  groupId?: string
): Promise<string[]> => {
  const matchQuery: ActivityQuery = {
    typeId: new mongoose.Types.ObjectId(typeId),
    description: { $exists: true, $ne: '' }
  };

  if (groupId) {
    if (!userGroupIds.includes(groupId)) throw new ForbiddenError('Access denied');
    matchQuery.groupId = groupId;
  } else {
    matchQuery.userId = userId;
    matchQuery.$or = [{ groupId: { $exists: false } }, { groupId: null }];
  }

  const descriptions: string[] = await Activity.distinct('description', matchQuery);
  return descriptions.filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
};
