import { Request, Response } from 'express';
import * as assetClassService from '../services/assetClass.service';

// Get all asset classes
export const getAssetClasses = async (req: Request, res: Response) => {
  try {
    const { groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    let assetClasses;
    if (groupId) {
      // Get asset classes for specific group (user must be member)
      assetClasses = await assetClassService.getAssetClassesByGroup(groupId as string, user.id, userGroups);
    } else {
      // No groupId specified: show only personal asset classes (no group)
      assetClasses = await assetClassService.getPersonalAssetClasses(user.id);
    }

    res.json(assetClasses);
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(500).json({ error: 'Failed to fetch asset classes' });
    }
  }
};

// Add a new asset class
export const createAssetClass = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const assetClassData = {
      ...req.body,
      userId: user.id
    };
    const assetClass = await assetClassService.createAssetClass(assetClassData);
    res.status(201).json(assetClass);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create asset class', details: err });
  }
};

// Delete an asset class
export const deleteAssetClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    await assetClassService.deleteAssetClass(id, user.id, userGroups);
    res.json({ success: true });
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else if (err.message === 'Asset class not found') {
      res.status(404).json({ error: 'Asset class not found' });
    } else {
      res.status(400).json({ error: 'Failed to delete asset class', details: err });
    }
  }
};

// Update an asset class
export const updateAssetClass = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const updated = await assetClassService.updateAssetClass(id, req.body, user.id, userGroups);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else if (err.message === 'Asset class not found') {
      res.status(404).json({ error: 'Asset class not found' });
    } else {
      res.status(400).json({ error: 'Failed to update asset class', details: err });
    }
  }
};