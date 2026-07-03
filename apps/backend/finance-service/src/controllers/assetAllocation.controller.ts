import { Request, Response } from 'express';
import * as assetAllocationService from '../services/assetAllocation.service';

/**
 * Get asset allocations
 */
export const getAssetAllocations = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { groupId } = req.query;

    let allocations;
    if (groupId) {
      // Get allocations for specific group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
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
  } catch (error: any) {
    console.error('Error fetching asset allocations:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch asset allocations'
    });
  }
};

/**
 * Create asset allocation
 */
export const createAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error: any) {
    console.error('Error creating asset allocation:', error);
    const statusCode = error.message.includes('required') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create asset allocation'
    });
  }
};

/**
 * Update asset allocation
 */
export const updateAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { id } = req.params;

    const updated = await assetAllocationService.updateAssetAllocation(id as string, req.body, user.id, userGroups);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Asset allocation not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Asset allocation updated successfully',
      data: updated
    });
  } catch (error: any) {
    console.error('Error updating asset allocation:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('not found')
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update asset allocation'
    });
  }
};

/**
 * Delete asset allocation
 */
export const deleteAssetAllocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { id } = req.params;

    await assetAllocationService.deleteAssetAllocation(id as string, user.id, userGroups);

    res.json({
      success: true,
      message: 'Asset allocation deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting asset allocation:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('not found')
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete asset allocation'
    });
  }
};