import { Request, Response } from 'express';
import { ForbiddenError } from '@tumbaland/core';
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

  res.json({
    success: true,
    data: allocations
  });
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

  res.status(201).json({
    success: true,
    message: 'Asset allocation created successfully',
    data: allocation
  });
};

/**
 * Update asset allocation
 */
export const updateAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await assetAllocationService.updateAssetAllocation(id as string, req.body, user.id, userGroups);

  res.json({
    success: true,
    message: 'Asset allocation updated successfully',
    data: updated
  });
};

/**
 * Delete asset allocation
 */
export const deleteAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await assetAllocationService.deleteAssetAllocation(id as string, user.id, userGroups);

  res.json({
    success: true,
    message: 'Asset allocation deleted successfully'
  });
};
