import { BadRequestError, ConflictError, logger } from '@tumbaland/backend-core';
import { ActivityType, IActivityType } from '../models/ActivityType';
import { seedDefaultActivityTypes } from './defaultActivityTypes';

interface ActivityTypeQuery {
  isActive?: boolean;
  slug?: string;
  userId?: string;
  groupId?: string;
  $or?: Record<string, unknown>[];
}

/**
 * Query matching the one scope a slug has to be unique within: a single group,
 * or a single user's personal (non-group) types. Mirrors the partial unique
 * indexes on the model — keep the two in step.
 */
const slugScopeQuery = (
  slug: string,
  userId?: string,
  groupId?: string
): Record<string, unknown> =>
  groupId
    ? { slug, groupId }
    : { slug, userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };

// Create a new activity type
export const createActivityType = async (typeData: Partial<IActivityType>): Promise<IActivityType> => {
  logger.info('Creating activity type', { typeData });

  // A slug only has to be unique within its own scope, so that one user's
  // "movies" doesn't block everyone else's.
  const existingType = await ActivityType.findOne(
    slugScopeQuery(typeData.slug as string, typeData.userId, typeData.groupId)
  );
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
      // Group context - the group's own types only.
      //
      // This used to fall back to the caller's personal types when the group had
      // none, which reads as helpful and is not: the day editor then offers a
      // personal type inside a group, entries get recorded against it, and those
      // entries belong to a type nobody else in the group can see. Deleting that
      // type personally strands them — which is exactly what happened. A group
      // with no types of its own is seeded with the defaults below instead.
      query.groupId = groupId;
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
    // No user context. Every caller reaches this through authentication, so
    // arriving without a user means the middleware handed over something it did
    // not understand — which is exactly what happened when an OAuth access
    // token was read as a session and its `sub` never became `user.id`.
    //
    // This used to answer with every active type in the database, which is one
    // account reading another's. It also read as working, so the real fault
    // surfaced only on the first write, where there is no such fallback to hide
    // it. Refusing keeps the failure where the mistake is.
    logger.error('getActivityTypes called with no user context');
    throw new BadRequestError('Cannot list activity types without a user');
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Execute queries
  const [types, total] = await Promise.all([
    ActivityType.find(query).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    ActivityType.countDocuments(query)
  ]);

  // A scope with nothing in it is a brand-new account, and an empty list is a
  // dead end: entries are recorded against a type, so an assistant asked to log
  // anything can only reply that there is nothing to log against. Seeding on the
  // first read puts that right without a setup step, and is safe to race —
  // `seedDefaultActivityTypes` relies on the unique slug indexes rather than a
  // check-then-write. Only the first page is considered, since a later page
  // being empty says nothing about the scope.
  if (total === 0 && userId && page === 1) {
    const seeded = await seedDefaultActivityTypes(userId, groupId ?? undefined);
    if (seeded.length > 0) {
      logger.info('Seeded default activity types for a new scope', {
        userId,
        groupId: groupId ?? null,
        count: seeded.length
      });
      const [freshTypes, freshTotal] = await Promise.all([
        ActivityType.find(query).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
        ActivityType.countDocuments(query)
      ]);
      return {
        types: freshTypes,
        total: freshTotal,
        page,
        totalPages: Math.ceil(freshTotal / limit)
      };
    }
  }

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
    // Group scope only — see the note in getActivityTypes.
    query.groupId = groupId;
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
  // If slug is being updated, check for uniqueness within the type's own scope.
  // The scope comes from the update where given, otherwise from the stored doc.
  if (updateData.slug) {
    const current = await ActivityType.findById(id).select('userId groupId');
    if (!current) return null;

    const userId = updateData.userId ?? current.userId;
    const groupId = updateData.groupId ?? current.groupId;

    const existingType = await ActivityType.findOne({
      ...slugScopeQuery(updateData.slug, userId, groupId),
      _id: { $ne: id }
    });
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
