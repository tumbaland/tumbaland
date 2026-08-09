import { Request, Response } from 'express';
import { BadRequestError, ForbiddenError, sendSuccess, sendError } from '@tumbaland/backend-core';
import {
  getAllTrackedTickers,
  getTrackedTickerById,
  createTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker
} from '../services/trackedTicker.service';
import { searchTickers } from '../services/alphaVantage.service';
import {
  releaseTickerSlot,
  tickerActor,
  withTickerSlot,
  withTickerUpdate
} from '../services/trackedTickerUsage';

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
 *
 * Metered: a symbol the account does not already follow costs a slot from the
 * plan's `trackedTickers` allowance, and the write is refused with a 402 when
 * that would overrun. See `trackedTickerUsage`.
 */
export const addTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await withTickerSlot(
    tickerActor(req),
    { ticker: req.body.ticker, groupId: req.body.groupId, isActive: req.body.isActive },
    () => createTrackedTicker(req.body, user.id, userGroups)
  );

  sendSuccess(res, created, 'Ticker added successfully', 201);
};

/**
 * Update tracked ticker
 *
 * Renaming the symbol, moving it between groups and pausing it all change what
 * the account is billed for, so the meter is resynced around the write.
 */
export const editTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const before = await getTrackedTickerById(id as string);

  const updated = await withTickerUpdate(
    tickerActor(req),
    before
      ? {
          id: String(before._id),
          ticker: before.ticker,
          groupId: before.groupId,
          isActive: before.isActive
        }
      : null,
    req.body,
    () => updateTrackedTicker(id as string, req.body, user.id, userGroups)
  );

  if (!updated) {
    sendError(res, 'Tracked ticker not found', 404);
    return;
  }

  sendSuccess(res, updated, 'Ticker updated successfully');
};

/**
 * Delete tracked ticker
 *
 * Hands the slot back, unless another row still tracks the same symbol for the
 * same account — a meter that only counts up surfaces months later as a user
 * who cannot add a ticker despite tracking none.
 */
export const removeTrackedTicker = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const deleted = await deleteTrackedTicker(id as string, user.id, userGroups);

  if (deleted) {
    await releaseTickerSlot(tickerActor(req), {
      ticker: deleted.ticker,
      groupId: deleted.groupId,
      isActive: deleted.isActive
    });
  }

  sendSuccess(res, undefined, 'Ticker deleted successfully');
};
