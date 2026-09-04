import { Request, Response } from 'express';
import { ForbiddenError, sendSuccess, sendError, countRead } from '@tumbaland/backend-core';
import * as holdingService from '../services/holding.service';
import { tickerActor, withTickerSlot } from '../services/trackedTickerUsage';

/**
 * Get holdings enriched with latest/ATH prices
 */
export const getHoldings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  let holdings;
  if (groupId) {
    // Get holdings for specific group (user must be member)
    if (!userGroups.includes(groupId as string)) {
      throw new ForbiddenError('Access denied');
    }
    holdings = await holdingService.getAllHoldings(user.id, [groupId as string]);
  } else {
    // No groupId specified: show only personal holdings (no group)
    holdings = await holdingService.getAllHoldings(user.id, []);
  }

  countRead(res, holdings.length);
  sendSuccess(res, holdings);
};

/**
 * Create holding (also starts tracking its ticker for daily prices)
 *
 * Metered on that side effect: `createHolding` creates or reactivates the
 * TrackedTicker row, so without this the `trackedTickers` limit would be
 * bypassable by adding holdings instead of tickers. A symbol the account
 * already follows costs nothing.
 */
export const addHolding = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await withTickerSlot(
    tickerActor(req),
    { ticker: req.body.ticker, groupId: req.body.groupId },
    () => holdingService.createHolding(req.body, user.id, userGroups)
  );

  sendSuccess(res, created, 'Holding added successfully', 201);
};

/**
 * Update holding
 */
export const editHolding = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await holdingService.updateHolding(id as string, req.body, user.id, userGroups);

  if (!updated) {
    sendError(res, 'Holding not found', 404);
    return;
  }

  sendSuccess(res, updated, 'Holding updated successfully');
};

/**
 * Delete holding
 */
export const removeHolding = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await holdingService.deleteHolding(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Holding deleted successfully');
};
