import { Request, Response } from 'express';
import * as assetClassService from '../services/assetClass.service';

/**
 * Get asset classes
 */
export const getAssetClasses = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { groupId } = req.query;

    let assetClasses;
    if (groupId) {
      // Get asset classes for specific group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
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
  } catch (error: any) {
    console.error('Error fetching asset classes:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch asset classes'
    });
  }
};

/**
 * Create asset class
 */
export const createAssetClass = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error: any) {
    console.error('Error creating asset class:', error);
    const statusCode = error.message.includes('required') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create asset class'
    });
  }
};

/**
 * Update asset class
 */
export const updateAssetClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { id } = req.params;

    const updated = await assetClassService.updateAssetClass(id as string, req.body, user.id, userGroups);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Asset class not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Asset class updated successfully',
      data: updated
    });
  } catch (error: any) {
    console.error('Error updating asset class:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('not found')
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update asset class'
    });
  }
};

/**
 * Delete asset class
 */
export const deleteAssetClass = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { id } = req.params;

    await assetClassService.deleteAssetClass(id as string, user.id, userGroups);

    res.json({
      success: true,
      message: 'Asset class deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting asset class:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('not found')
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete asset class'
    });
  }
};