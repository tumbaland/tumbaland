import TrackedTicker from '../models/TrackedTicker';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

export const getAllTrackedTickers = async (userId: string, userGroups: string[] = []) => {
  // Build permission filter to only get tickers the user can access
  const accessQuery = buildAccessQuery(userId, userGroups, false);
  return TrackedTicker.find(accessQuery).sort({ ticker: 1 });
};

export const createTrackedTicker = async (
  data: {
    ticker: string;
    displayName: string;
    description?: string;
    isActive?: boolean;
    groupId?: string;
  },
  userId: string,
  userGroups: string[] = []
) => {
  // If groupId is provided, verify user has access to that group
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new Error('ACCESS_DENIED');
  }
  
  const tracked = new TrackedTicker({
    ...data,
    userId,
    dateAdded: new Date(),
    isActive: data.isActive !== undefined ? data.isActive : true
  });
  return tracked.save();
};

export const updateTrackedTicker = async (
  id: string,
  data: { ticker?: string; displayName?: string; description?: string; isActive?: boolean; groupId?: string },
  userId: string,
  userGroups: string[] = []
) => {
  // First check if user has access to this ticker
  const existingTicker = await TrackedTicker.findById(id);
  if (!existingTicker) {
    return null;
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingTicker.userId || '',
    existingTicker.groupId,
    userGroups,
    false // tickers are not public
  );

  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  // If groupId is being updated, verify user has access to the new group
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new Error('ACCESS_DENIED');
  }

  return TrackedTicker.findByIdAndUpdate(id, data, { new: true });
};

export const deleteTrackedTicker = async (id: string, userId: string, userGroups: string[] = []) => {
  // First check if user has access to this ticker
  const existingTicker = await TrackedTicker.findById(id);
  if (!existingTicker) {
    throw new Error('Ticker not found');
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingTicker.userId || '',
    existingTicker.groupId,
    userGroups,
    false // tickers are not public
  );

  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  return TrackedTicker.findByIdAndDelete(id);
};
