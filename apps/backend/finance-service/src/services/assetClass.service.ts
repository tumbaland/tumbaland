import AssetClass, { IAssetClass } from '../models/AssetClass';
import { canAccessResource, ForbiddenError, NotFoundError } from '@tumbaland/backend-core';

export const getPersonalAssetClasses = async (userId: string) => {
  // Get only personal asset classes (no group association)
  return AssetClass.find({
    userId,
    groupId: { $exists: false }
  }).sort({ name: 1 });
};

export const getAssetClassesByGroup = async (groupId: string, userId: string, userGroupIds: string[]) => {
  // Check if user has access to the group
  if (!userGroupIds.includes(groupId)) {
    throw new ForbiddenError('Access denied');
  }

  return AssetClass.find({ groupId }).sort({ name: 1 });
};

export const createAssetClass = async (data: Partial<IAssetClass>) => {
  const assetClass = new AssetClass(data);
  return assetClass.save();
};

/** The asset class, if it exists and the user may change it. */
const loadAccessible = async (id: string, userId: string, userGroupIds: string[]) => {
  const assetClass = await AssetClass.findById(id);
  if (!assetClass) {
    throw new NotFoundError('Asset class not found');
  }
  if (!canAccessResource(userId, assetClass.userId, assetClass.groupId, userGroupIds, false)) {
    throw new ForbiddenError('Access denied');
  }
  return assetClass;
};

export const deleteAssetClass = async (id: string, userId: string, userGroupIds: string[] = []) => {
  await loadAccessible(id, userId, userGroupIds);

  return AssetClass.findByIdAndDelete(id);
};

export const updateAssetClass = async (id: string, data: Partial<IAssetClass>, userId: string, userGroupIds: string[] = []) => {
  await loadAccessible(id, userId, userGroupIds);

  // Moving a class into a group is writing into that group.
  if (data.groupId && !userGroupIds.includes(data.groupId)) {
    throw new ForbiddenError('Access denied');
  }

  return AssetClass.findByIdAndUpdate(id, data, { new: true });
};