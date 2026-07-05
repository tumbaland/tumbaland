import { Request, Response } from 'express';
import { ForbiddenError, sendSuccess } from '@tumbaland/core';
import * as assetAllocationService from '../services/assetAllocation.service';

/**
 * Get asset allocations
 */
export const getAssetAllocations = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  let allocations;
  if (groupId) {
    // Get allocations for specific group (user must be member)
    if (!userGroups.includes(groupId as string)) {
      throw new ForbiddenError('Access denied');
    }
    allocations = await assetAllocationService.getAssetAllocationsByGroup(groupId as string, user.id, userGroups);
  } else {
    // No groupId specified: show only personal allocations (no group)
    allocations = await assetAllocationService.getPersonalAssetAllocations(user.id);
  }

  sendSuccess(res, allocations);
};

/**
 * Create asset allocation
 */
export const createAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  const allocationData = {
    ...req.body,
    userId: user.id
  };

  const allocation = await assetAllocationService.createAssetAllocation(allocationData);

  sendSuccess(res, allocation, 'Asset allocation created successfully', 201);
};

/**
 * Update asset allocation
 */
export const updateAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await assetAllocationService.updateAssetAllocation(id as string, req.body, user.id, userGroups);

  sendSuccess(res, updated, 'Asset allocation updated successfully');
};

/**
 * Delete asset allocation
 */
export const deleteAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await assetAllocationService.deleteAssetAllocation(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Asset allocation deleted successfully');
};
