import { ConflictError, logger } from '@tumbaland/backend-core';
import { ActivityType, IActivityType } from '../models/ActivityType';

interface ActivityTypeQuery {
  isActive?: boolean;
  slug?: string;
  userId?: string;
  $or?: Record<string, unknown>[];
}

// Create a new activity type
export const createActivityType = async (typeData: Partial<IActivityType>): Promise<IActivityType> => {
  logger.info('Creating activity type', { typeData });

  // Check if slug already exists
  const existingType = await ActivityType.findOne({ slug: typeData.slug });
  if (existingType) {
    throw new ConflictError('Activity type with this slug already exists');
  }

  const activityType = new ActivityType(typeData);
  const saved = await activityType.save();

  logger.info('Activity type created successfully', { id: saved._id });

  return saved;
};

// Get all activity types with optional filters
export const getActivityTypes = async (
  filters: {
    userId?: string;
    groupId?: string | null;
    isActive?: boolean;
    limit?: number;
    page?: number;
  } = {}
): Promise<{ types: IActivityType[]; total: number; page: number; totalPages: number }> => {
  const {
    userId,
    groupId,
    isActive = true,
    limit = 50,
    page = 1
  } = filters;

  // Build query
  const query: ActivityTypeQuery = {};

  if (isActive !== undefined) {
    query.isActive = isActive;
  }

  // Apply permission filtering
  if (groupId !== undefined) {
    if (groupId !== null) {
      // Group context - show group types and fallback to user's personal types
      query.$or = [
        { groupId },
        { userId, groupId: { $exists: false } }
      ];
    } else {
      // Personal context (groupId explicitly set to null) - show only user's personal types
      query.userId = userId;
      query.$or = [
        { groupId: { $exists: false } },
        { groupId: null }
      ];
    }
  } else if (userId) {
    // No groupId parameter provided - default to personal context
    query.userId = userId;
    query.$or = [
      { groupId: { $exists: false } },
      { groupId: null }
    ];
  } else {
    // No user context - this shouldn't happen in production, but return active types
    logger.warn('No userId provided to getActivityTypes - this should not happen in production');
    query.isActive = true;
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute queries
  const [types, total] = await Promise.all([
    ActivityType.find(query).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    ActivityType.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    types,
    total,
    page,
    totalPages
  };
};

// Get activity type by ID
export const getActivityTypeById = async (id: string): Promise<IActivityType | null> => {
  return ActivityType.findById(id);
};

// Get activity type by slug
export const getActivityTypeBySlug = async (slug: string, userId?: string, groupId?: string): Promise<IActivityType | null> => {
  const query: ActivityTypeQuery = { slug, isActive: true };

  if (groupId) {
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

  return ActivityType.findOne(query);
};

// Update activity type by ID
export const updateActivityType = async (id: string, updateData: Partial<IActivityType>): Promise<IActivityType | null> => {
  // If slug is being updated, check for uniqueness
  if (updateData.slug) {
    const existingType = await ActivityType.findOne({ slug: updateData.slug, _id: { $ne: id } });
    if (existingType) {
      throw new ConflictError('Activity type with this slug already exists');
    }
  }

  return ActivityType.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
};

// Delete activity type by ID (soft delete by setting isActive to false)
export const deleteActivityType = async (id: string): Promise<boolean> => {
  const result = await ActivityType.findByIdAndUpdate(id, { isActive: false });
  return !!result;
};

// Hard delete activity type (use with caution)
export const hardDeleteActivityType = async (id: string): Promise<boolean> => {
  const result = await ActivityType.findByIdAndDelete(id);
  return !!result;
};

// Reorder activity types
export const reorderActivityTypes = async (typeIds: string[], userId: string, groupId?: string): Promise<void> => {
  const bulkOps = typeIds.map((id, index) => ({
    updateOne: {
      filter: {
        _id: id,
        userId,
        ...(groupId ? { groupId } : { groupId: { $exists: false } })
      },
      update: { sortOrder: index }
    }
  }));

  await ActivityType.bulkWrite(bulkOps);
};
