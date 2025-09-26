import { ActivityType, IActivityType } from '../models/ActivityType';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

// Create a new activity type
export const createActivityType = async (typeData: Partial<IActivityType>): Promise<IActivityType> => {
  try {
    console.log('Creating activity type with data:', typeData);

    // Check if slug already exists
    const existingType = await ActivityType.findOne({ slug: typeData.slug });
    if (existingType) {
      throw new Error('Activity type with this slug already exists');
    }

    const activityType = new ActivityType(typeData);
    const saved = await activityType.save();

    console.log('Activity type created successfully:', saved);

    return saved;
  } catch (error: any) {
    console.error('Failed to create activity type:', error);
    throw new Error(`Failed to create activity type: ${error.message}`);
  }
};

// Get all activity types with optional filters
export const getActivityTypes = async (
  filters: {
    userId?: string;
    groupId?: string;
    isActive?: boolean;
    limit?: number;
    page?: number;
  } = {}
): Promise<{ types: IActivityType[]; total: number; page: number; totalPages: number }> => {
  try {
    const {
      userId,
      groupId,
      isActive = true,
      limit = 50,
      page = 1
    } = filters;

    console.log('getActivityTypes called with filters:', { userId, groupId, isActive, limit, page });

    // Build query
    let query: any = {};

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
        console.log('Group context query:', JSON.stringify(query, null, 2));
      } else {
        // Personal context (groupId explicitly set to null) - show only user's personal types
        query.userId = userId;
        query.$or = [
          { groupId: { $exists: false } },
          { groupId: null }
        ];
        console.log('Personal context (null groupId) query:', JSON.stringify(query, null, 2));
      }
    } else if (userId) {
      // No groupId parameter provided - default to personal context
      query.userId = userId;
      query.$or = [
        { groupId: { $exists: false } },
        { groupId: null }
      ];
      console.log('Default personal context query:', JSON.stringify(query, null, 2));
    } else {
      // No user context - this shouldn't happen in production, but return active types
      console.warn('No userId provided to getActivityTypes - this should not happen in production');
      query.isActive = true;
    }

    console.log('Final query:', JSON.stringify(query, null, 2));

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [types, total] = await Promise.all([
      ActivityType.find(query).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityType.countDocuments(query)
    ]);

    console.log(`Found ${types.length} activity types (total: ${total})`);

    const totalPages = Math.ceil(total / limit);

    return {
      types: types as IActivityType[],
      total,
      page,
      totalPages
    };
  } catch (error: any) {
    console.error(`Failed to get activity types: ${error.message}`);
    throw new Error(`Failed to get activity types: ${error.message}`);
  }
};

// Get activity type by ID
export const getActivityTypeById = async (id: string): Promise<IActivityType | null> => {
  try {
    return await ActivityType.findById(id);
  } catch (error: any) {
    throw new Error(`Failed to get activity type: ${error.message}`);
  }
};

// Get activity type by slug
export const getActivityTypeBySlug = async (slug: string, userId?: string, groupId?: string): Promise<IActivityType | null> => {
  try {
    const query: any = { slug, isActive: true };

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

    return await ActivityType.findOne(query);
  } catch (error: any) {
    throw new Error(`Failed to get activity type: ${error.message}`);
  }
};

// Update activity type by ID
export const updateActivityType = async (id: string, updateData: Partial<IActivityType>): Promise<IActivityType | null> => {
  try {
    // If slug is being updated, check for uniqueness
    if (updateData.slug) {
      const existingType = await ActivityType.findOne({ slug: updateData.slug, _id: { $ne: id } });
      if (existingType) {
        throw new Error('Activity type with this slug already exists');
      }
    }

    return await ActivityType.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  } catch (error: any) {
    throw new Error(`Failed to update activity type: ${error.message}`);
  }
};

// Delete activity type by ID (soft delete by setting isActive to false)
export const deleteActivityType = async (id: string): Promise<boolean> => {
  try {
    const result = await ActivityType.findByIdAndUpdate(id, { isActive: false });
    return !!result;
  } catch (error: any) {
    throw new Error(`Failed to delete activity type: ${error.message}`);
  }
};

// Hard delete activity type (use with caution)
export const hardDeleteActivityType = async (id: string): Promise<boolean> => {
  try {
    const result = await ActivityType.findByIdAndDelete(id);
    return !!result;
  } catch (error: any) {
    throw new Error(`Failed to hard delete activity type: ${error.message}`);
  }
};

// Reorder activity types
export const reorderActivityTypes = async (typeIds: string[], userId: string, groupId?: string): Promise<void> => {
  try {
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
  } catch (error: any) {
    throw new Error(`Failed to reorder activity types: ${error.message}`);
  }
};