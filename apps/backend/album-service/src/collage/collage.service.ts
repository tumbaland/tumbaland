import { CollageInput } from './collage.types';
import { CollageModel, ICollage } from './collage.model';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

export const createCollage = async (
  data: CollageInput, 
  userId: string, 
  userGroups: string[] = []
): Promise<ICollage> => {
  // Set the userId on the collage data
  const collageData = {
    ...data,
    userId
  };
  
  const collage = new CollageModel(collageData);
  await collage.save();
  return collage;
};

export const updateCollage = async (
  id: string, 
  data: CollageInput, 
  userId: string, 
  userGroups: string[] = []
): Promise<ICollage | null> => {
  // First check if user has access to this collage
  const existingCollage = await CollageModel.findById(id);
  if (!existingCollage) {
    return null;
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingCollage.userId || '',
    existingCollage.groupId,
    userGroups,
    false // collages are not public
  );

  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  const collage = await CollageModel.findByIdAndUpdate(id, data, { new: true });
  return collage;
};

export const getCollageById = async (
  id: string, 
  userId: string, 
  userGroups: string[] = []
): Promise<ICollage | null> => {
  const collage = await CollageModel.findById(id);
  
  if (!collage) {
    return null;
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    collage.userId || '',
    collage.groupId,
    userGroups,
    false // collages are not public
  );

  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  return collage;
};

export const getCollageList = async (
  albumId?: string, 
  userId?: string, 
  userGroups: string[] = [],
  groupId?: string
): Promise<ICollage[]> => {
  let filter: any = {};
  
  // Add album filter if provided
  if (albumId) {
    filter.albumIds = { $in: [albumId] };
  }

  // Apply permission filtering
  if (userId) {
    if (groupId) {
      // If groupId is specified, filter by group (user must be member)
      if (!userGroups.includes(groupId)) {
        throw new Error('ACCESS_DENIED');
      }
      filter.groupId = groupId;
    } else {
      // No groupId specified: show only personal collages (no group)
      filter.userId = userId;
      filter.groupId = { $exists: false };
    }
  }

  return CollageModel.find(filter).sort({ createdAt: -1 });
};

export const deleteCollage = async (
  id: string, 
  userId: string, 
  userGroups: string[] = []
): Promise<void> => {
  // First check if user has access to this collage
  const existingCollage = await CollageModel.findById(id);
  if (!existingCollage) {
    throw new Error('Collage not found');
  }

  // Check permissions
  const hasAccess = canAccessResource(
    userId,
    existingCollage.userId || '',
    existingCollage.groupId,
    userGroups,
    false // collages are not public
  );

  if (!hasAccess) {
    throw new Error('ACCESS_DENIED');
  }

  await CollageModel.findByIdAndDelete(id);
};
