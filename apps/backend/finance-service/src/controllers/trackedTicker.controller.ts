import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError } from '@tumbaland/core';
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
  const { q } = req.query;
  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw new BadRequestError('Query must be at least 2 characters');
  }

  const results = await searchTickers(q.trim());

  res.json({ success: true, data: results });
};

/**
 * Get tracked tickers
 */
export const getTrackedTickers = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  let tickers;
  if (groupId) {
    // Get tickers for specific group (user must be member)
    if (!userGroups.includes(groupId as string)) {
      throw new ForbiddenError('Access denied');
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
};

/**
 * Create tracked ticker
 */
export const addTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await createTrackedTicker(req.body, user.id, userGroups);

  res.status(201).json({
    success: true,
    message: 'Ticker added successfully',
    data: created
  });
};

/**
 * Update tracked ticker
 */
export const editTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
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
};

/**
 * Delete tracked ticker
 */
export const removeTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await deleteTrackedTicker(id as string, user.id, userGroups);

  res.json({
    success: true,
    message: 'Ticker deleted successfully'
  });
};
