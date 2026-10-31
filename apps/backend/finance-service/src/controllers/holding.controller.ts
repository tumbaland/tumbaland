import { Request, Response } from 'express';
import { sendSuccess, sendError, countRead } from '@tumbaland/backend-core';
import * as holdingService from '../services/holding.service';
import { getClosedPositions } from '../services/closedPosition.service';
import { contextGroups } from '../utils/scope';
import { tickerActor, withTickerSlot } from '../services/trackedTickerUsage';

/**
 * Get holdings enriched with latest/ATH prices
 */
export const getHoldings = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  // The query group's holdings, or with no groupId only personal ones.
  const holdings = await holdingService.getAllHoldings(user.id, contextGroups(req));

  countRead(res, holdings.length);
  sendSuccess(res, holdings);
};

/**
 * Positions that were bought and sold out entirely, with what they made.
 */
export const getClosed = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const closed = await getClosedPositions(user.id, contextGroups(req));

  countRead(res, closed.length);
  sendSuccess(res, closed);
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
