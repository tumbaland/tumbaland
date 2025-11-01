import AssetAllocation, { IAssetAllocation } from '../models/AssetAllocation';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

export const getAllAssetAllocations = async () => {
  return AssetAllocation.find().populate('assetClassId', 'name').sort({ date: -1 });
};

export const getAssetAllocationsByUser = async (userId: string, groupIds: string[] = []) => {
  const query = buildAccessQuery(userId, groupIds, false);
  return AssetAllocation.find(query).populate('assetClassId', 'name').sort({ date: -1 });
};

export const getPersonalAssetAllocations = async (userId: string) => {
  // Get only personal asset allocations (no group association)
  return AssetAllocation.find({
    userId,
    groupId: { $exists: false }
  }).populate('assetClassId', 'name').sort({ date: -1 });
};

export const getAssetAllocationsByGroup = async (groupId: string, userId: string, userGroupIds: string[]) => {
  // Check if user has access to the group
  if (!userGroupIds.includes(groupId)) {
    throw new Error('ACCESS_DENIED');
  }

  return AssetAllocation.find({ groupId }).populate('assetClassId', 'name').sort({ date: -1 });
};

export const createAssetAllocation = async (data: Partial<IAssetAllocation>) => {
  const allocation = new AssetAllocation(data);
  return allocation.save();
};

export const deleteAssetAllocation = async (id: string, userId: string, userGroupIds: string[] = []) => {
  const allocation = await AssetAllocation.findById(id);
  if (!allocation) {
    throw new Error('Asset allocation not found');
  }

  const hasAccess = canAccessResource(
    userId,
    allocation.userId,
    allocation.groupId,
    userGroupIds,
    false
  );
  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  return AssetAllocation.findByIdAndDelete(id);
};

export const updateAssetAllocation = async (id: string, data: Partial<IAssetAllocation>, userId: string, userGroupIds: string[] = []) => {
  const allocation = await AssetAllocation.findById(id);
  if (!allocation) {
    throw new Error('Asset allocation not found');
  }

  const hasAccess = canAccessResource(
    userId,
    allocation.userId,
    allocation.groupId,
    userGroupIds,
    false
  );
  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  return AssetAllocation.findByIdAndUpdate(id, data, { new: true });
};