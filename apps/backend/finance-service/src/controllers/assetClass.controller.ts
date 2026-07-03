import { Request, Response } from 'express';
import { ForbiddenError } from '@tumbaland/core';
import * as assetClassService from '../services/assetClass.service';

/**
 * Get asset classes
 */
export const getAssetClasses = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  let assetClasses;
  if (groupId) {
    // Get asset classes for specific group (user must be member)
    if (!userGroups.includes(groupId as string)) {
      throw new ForbiddenError('Access denied');
    }
    assetClasses = await assetClassService.getAssetClassesByGroup(groupId as string, user.id, userGroups);
  } else {
    // No groupId specified: show only personal asset classes (no group)
    assetClasses = await assetClassService.getPersonalAssetClasses(user.id);
  }

  res.json({
    success: true,
    data: assetClasses
  });
};

/**
 * Create asset class
 */
export const createAssetClass = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const assetClassData = {
    ...req.body,
    userId: user.id
  };

  const assetClass = await assetClassService.createAssetClass(assetClassData);

  res.status(201).json({
    success: true,
    message: 'Asset class created successfully',
    data: assetClass
  });
};

/**
 * Update asset class
 */
export const updateAssetClass = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await assetClassService.updateAssetClass(id as string, req.body, user.id, userGroups);

  res.json({
    success: true,
    message: 'Asset class updated successfully',
    data: updated
  });
};

/**
 * Delete asset class
 */
export const deleteAssetClass = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await assetClassService.deleteAssetClass(id as string, user.id, userGroups);

  res.json({
    success: true,
    message: 'Asset class deleted successfully'
  });
};
