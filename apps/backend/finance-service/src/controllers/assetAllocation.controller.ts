import { Request, Response } from 'express';
import * as assetAllocationService from '../services/assetAllocation.service';

// Get all asset allocations
export const getAssetAllocations = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    let allocations;
    if (groupId) {
      // Get allocations for specific group (user must be member)
      allocations = await assetAllocationService.getAssetAllocationsByGroup(groupId as string, user.id, userGroups);
    } else {
      // No groupId specified: show only personal allocations (no group)
      allocations = await assetAllocationService.getPersonalAssetAllocations(user.id);
    }

    res.json(allocations);
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(500).json({ error: 'Failed to fetch asset allocations' });
    }
  }
};

// Add a new asset allocation
export const createAssetAllocation = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const allocationData = {
      ...req.body,
      userId: user.id
    };
    const allocation = await assetAllocationService.createAssetAllocation(allocationData);
    res.status(201).json(allocation);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create asset allocation', details: err });
  }
};

// Delete an asset allocation
export const deleteAssetAllocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    await assetAllocationService.deleteAssetAllocation(id as string, user.id, userGroups);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else if (err.message === 'Asset allocation not found') {
      res.status(404).json({ error: 'Asset allocation not found' });
    } else {
      res.status(400).json({ error: 'Failed to delete asset allocation', details: err });
    }
  }
};

// Update an asset allocation
export const updateAssetAllocation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const updated = await assetAllocationService.updateAssetAllocation(id as string, req.body, user.id, userGroups);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else if (err.message === 'Asset allocation not found') {
      res.status(404).json({ error: 'Asset allocation not found' });
    } else {
      res.status(400).json({ error: 'Failed to update asset allocation', details: err });
    }
  }
};