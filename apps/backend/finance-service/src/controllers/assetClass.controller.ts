import { Request, Response } from 'express';
import { sendSuccess } from '@tumbaland/backend-core';
import * as assetClassService from '../services/assetClass.service';
import { contextGroupId } from '../utils/scope';

/**
 * Get asset classes
 */
export const getAssetClasses = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const groupId = contextGroupId(req);

  let assetClasses;
  if (groupId) {
    assetClasses = await assetClassService.getAssetClassesByGroup(groupId, user.id, req.userGroups || []);
  } else {
    // No groupId specified: show only personal asset classes (no group)
    assetClasses = await assetClassService.getPersonalAssetClasses(user.id);
  }

  sendSuccess(res, assetClasses);
};

/**
 * Create asset class
 */
export const createAssetClass = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  // Creating a class in a group is writing into that group.
  contextGroupId(req, req.body.groupId);

  const assetClassData = {
    ...req.body,
    userId: user.id
  };

  const assetClass = await assetClassService.createAssetClass(assetClassData);

  sendSuccess(res, assetClass, 'Asset class created successfully', 201);
};

/**
 * Update asset class
 */
export const updateAssetClass = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await assetClassService.updateAssetClass(id as string, req.body, user.id, userGroups);

  sendSuccess(res, updated, 'Asset class updated successfully');
};

/**
 * Delete asset class
 */
export const deleteAssetClass = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await assetClassService.deleteAssetClass(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Asset class deleted successfully');
};
