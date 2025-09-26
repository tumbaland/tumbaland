import { Activity, IActivity } from '../models/Activity';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

// Create a new activity
export const createActivity = async (activityData: Partial<IActivity>): Promise<IActivity> => {
  try {
    const activity = new Activity(activityData);
    return await activity.save();
  } catch (error: any) {
    throw new Error(`Failed to create activity: ${error.message}`);
  }
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
  try {
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
    let query: any = {};

    if (activityType) {
      // Find the activity type by slug and get its ID
      const ActivityType = (await import('../models/ActivityType')).ActivityType;
      const typeDoc = await ActivityType.findOne({ slug: activityType, isActive: true });
      if (typeDoc) {
        query['activity.typeId'] = typeDoc._id;
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
      query['activity.description'] = { $regex: description, $options: 'i' };
    }

    // Apply permission filtering
    if (groupId) {
      // Check if user has access to the specific group
      if (!userGroupIds.includes(groupId)) {
        throw new Error('ACCESS_DENIED');
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
    const sortObj: any = {};
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Map frontend sort fields to database fields
    switch (sortBy) {
      case 'date':
        sortObj.date = sortDirection;
        break;
      case 'hours':
        sortObj.hours = sortDirection;
        break;
      case 'activity':
      case 'activityType':
        sortObj['activity.type'] = sortDirection;
        break;
      case 'description':
        sortObj['activity.description'] = sortDirection;
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
      Activity.find(query).populate('activity.typeId').sort(sortObj).skip(skip).limit(limit).lean(),
      Activity.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      activities: activities as IActivity[],
      total,
      page,
      totalPages
    };
  } catch (error: any) {
    throw new Error(`Failed to get activities: ${error.message}`);
  }
};

// Get activity by ID
export const getActivityById = async (id: string): Promise<IActivity | null> => {
  try {
    return await Activity.findById(id);
  } catch (error: any) {
    throw new Error(`Failed to get activity: ${error.message}`);
  }
};

// Update activity by ID
export const updateActivity = async (id: string, updateData: Partial<IActivity>): Promise<IActivity | null> => {
  try {
    return await Activity.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  } catch (error: any) {
    throw new Error(`Failed to update activity: ${error.message}`);
  }
};

// Delete activity by ID
export const deleteActivity = async (id: string): Promise<boolean> => {
  try {
    const result = await Activity.findByIdAndDelete(id);
    return !!result;
  } catch (error: any) {
    throw new Error(`Failed to delete activity: ${error.message}`);
  }
};

// Get activity statistics
export const getActivityStats = async (
  filters: {
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<any> => {
  try {
    const { startDate, endDate } = filters;

    // Build match stage for date filtering
    const matchStage: any = {};
    if (startDate || endDate) {
      matchStage.date = {};
      if (startDate) matchStage.date.$gte = startDate;
      if (endDate) matchStage.date.$lte = endDate;
    }

    const pipeline = [];

    // Add match stage if there are filters
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    } // Group by activity type
    pipeline.push({
      $group: {
        _id: '$activity.type',
        count: { $sum: 1 },
        totalHours: { $sum: '$hours' },
        avgHours: { $avg: '$hours' }
      }
    });

    // Sort by total hours descending
    pipeline.push({
      $sort: { totalHours: -1 as const }
    });

    const stats = await Activity.aggregate(pipeline);

    // Calculate overall totals
    const overallStats = await Activity.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: null,
          totalActivities: { $sum: 1 },
          totalHours: { $sum: '$hours' },
          avgHours: { $avg: '$hours' }
        }
      }
    ]);

    return {
      byType: stats,
      overall: overallStats[0] || {
        totalActivities: 0,
        totalHours: 0,
        avgHours: null
      }
    };
  } catch (error: any) {
    throw new Error(`Failed to get activity stats: ${error.message}`);
  }
};

// Get activities by date range
export const getActivitiesByDateRange = async (startDate: Date, endDate: Date): Promise<IActivity[]> => {
  try {
    return await Activity.find({
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: -1 });
  } catch (error: any) {
    throw new Error(`Failed to get activities by date range: ${error.message}`);
  }
};

// Get recent activities
export const getRecentActivities = async (limit: number = 10): Promise<IActivity[]> => {
  try {
    return await Activity.find().sort({ createdAt: -1 }).limit(limit);
  } catch (error: any) {
    throw new Error(`Failed to get recent activities: ${error.message}`);
  }
};

// Get unique activity types
export const getActivityTypes = async (userId?: string, groupId?: string): Promise<any[]> => {
  try {
    const ActivityType = (await import('../models/ActivityType')).ActivityType;
    const query: any = { isActive: true };

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

    return await ActivityType.find(query).sort({ sortOrder: 1 });
  } catch (error: any) {
    throw new Error(`Failed to get activity types: ${error.message}`);
  }
};
