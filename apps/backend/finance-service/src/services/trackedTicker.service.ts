import TrackedTicker from '../models/TrackedTicker';
import { canAccessResource, ForbiddenError, NotFoundError } from '@tumbaland/backend-core';

export const getAllTrackedTickers = async (userId: string, userGroups: string[] = []) => {
  if (userGroups.length === 0) {
    // Personal context: only personal tickers (no groupId)
    return TrackedTicker.find({ 
      userId,
      $or: [
        { groupId: { $exists: false } },
        { groupId: null }
      ]
    }).sort({ ticker: 1 });
  } else {
    // Group context: only group tickers
    return TrackedTicker.find({ 
      groupId: { $in: userGroups }
    }).sort({ ticker: 1 });
  }
};

/**
 * The raw row, for the usage sync to compare a pending update against.
 *
 * No permission check, deliberately: nothing here reaches the caller — the
 * update it precedes does its own authorization and refuses before anything is
 * written.
 */
export const getTrackedTickerById = async (id: string) => TrackedTicker.findById(id);

export const createTrackedTicker = async (
  data: {
    ticker: string;
    displayName: string;
    description?: string;
    currency?: string;
    isActive?: boolean;
    groupId?: string;
  },
  userId: string,
  userGroups: string[] = []
) => {
  // If groupId is provided, verify user has access to that group
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
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
  data: {
    ticker?: string;
    displayName?: string;
    description?: string;
    currency?: string;
    isActive?: boolean;
    groupId?: string;
  },
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
    throw new ForbiddenError('Access denied');
  }

  // If groupId is being updated, verify user has access to the new group
  if (data.groupId && !userGroups.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  return TrackedTicker.findByIdAndUpdate(id, data, { new: true });
};

export const deleteTrackedTicker = async (id: string, userId: string, userGroups: string[] = []) => {
  // First check if user has access to this ticker
  const existingTicker = await TrackedTicker.findById(id);
  if (!existingTicker) {
    throw new NotFoundError('Ticker not found');
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
    throw new ForbiddenError('Access denied');
  }

  return TrackedTicker.findByIdAndDelete(id);
};
