import { Request, Response } from 'express';
import {
  getAllTrackedTickers,
  createTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker
} from '../services/trackedTicker.service';
import { searchTickers } from '../services/alphaVantage.service';

/**
 * Search ticker symbols via Alpha Vantage SYMBOL_SEARCH (costs 1 API call)
 */
export const searchTrackedTickers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });
      return;
    }

    const results = await searchTickers(q.trim());

    res.json({ success: true, data: results });
  } catch (error: any) {
    console.error('Error searching tickers:', error);
    const isRateLimit = error.message?.includes('rate limit') || error.message?.includes('Rate limit');
    res.status(isRateLimit ? 429 : 500).json({
      success: false,
      message: error.message || 'Failed to search tickers'
    });
  }
};

/**
 * Get tracked tickers
 */
export const getTrackedTickers = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { groupId } = req.query;

    let tickers;
    if (groupId) {
      // Get tickers for specific group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
      }
      tickers = await getAllTrackedTickers(user.id, [groupId as string]);
    } else {
      // No groupId specified: show only personal tickers (no group)
      tickers = await getAllTrackedTickers(user.id, []);
    }

    res.json({
      success: true,
      data: tickers
    });
  } catch (error: any) {
    console.error('Error fetching tracked tickers:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch tracked tickers'
    });
  }
};

/**
 * Create tracked ticker
 */
export const addTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    const created = await createTrackedTicker(req.body, user.id, userGroups);

    res.status(201).json({
      success: true,
      message: 'Ticker added successfully',
      data: created
    });
  } catch (error: any) {
    console.error('Error adding tracked ticker:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('required')
          ? 400
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to add tracked ticker'
    });
  }
};

/**
 * Update tracked ticker
 */
export const editTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;

    const updated = await updateTrackedTicker(id as string, req.body, user.id, userGroups);

    if (!updated) {
      res.status(404).json({
        success: false,
        message: 'Tracked ticker not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Ticker updated successfully',
      data: updated
    });
  } catch (error: any) {
    console.error('Error updating tracked ticker:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update tracked ticker'
    });
  }
};

/**
 * Delete tracked ticker
 */
export const removeTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;

    await deleteTrackedTicker(id as string, user.id, userGroups);

    res.json({
      success: true,
      message: 'Ticker deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting tracked ticker:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('not found')
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete tracked ticker'
    });
  }
};
