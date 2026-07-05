import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError, sendSuccess, sendError } from '@tumbaland/core';
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

  sendSuccess(res, results);
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

  sendSuccess(res, tickers);
};

/**
 * Create tracked ticker
 */
export const addTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await createTrackedTicker(req.body, user.id, userGroups);

  sendSuccess(res, created, 'Ticker added successfully', 201);
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
    sendError(res, 'Tracked ticker not found', 404);
    return;
  }

  sendSuccess(res, updated, 'Ticker updated successfully');
};

/**
 * Delete tracked ticker
 */
export const removeTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await deleteTrackedTicker(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Ticker deleted successfully');
};
