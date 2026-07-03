import AssetClass, { IAssetClass } from '../models/AssetClass';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';
import { ForbiddenError, NotFoundError } from '@tumbaland/core';

export const getAllAssetClasses = async () => {
  return AssetClass.find().sort({ name: 1 });
};

export const getAssetClassesByUser = async (userId: string, groupIds: string[] = []) => {
  const query = buildAccessQuery(userId, groupIds, false);
  return AssetClass.find(query).sort({ name: 1 });
};

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

export const deleteAssetClass = async (id: string, userId: string, userGroupIds: string[] = []) => {
  const assetClass = await AssetClass.findById(id);
  if (!assetClass) {
    throw new NotFoundError('Asset class not found');
  }

  const hasAccess = canAccessResource(
    userId,
    assetClass.userId,
    assetClass.groupId,
    userGroupIds,
    false
  );
  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  return AssetClass.findByIdAndDelete(id);
};

export const updateAssetClass = async (id: string, data: Partial<IAssetClass>, userId: string, userGroupIds: string[] = []) => {
  const assetClass = await AssetClass.findById(id);
  if (!assetClass) {
    throw new NotFoundError('Asset class not found');
  }

  const hasAccess = canAccessResource(
    userId,
    assetClass.userId,
    assetClass.groupId,
    userGroupIds,
    false
  );
  if (!hasAccess) {
    throw new ForbiddenError('Access denied');
  }

  return AssetClass.findByIdAndUpdate(id, data, { new: true });
};