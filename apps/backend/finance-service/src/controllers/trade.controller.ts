import { Request, Response } from 'express';
import { ForbiddenError, sendSuccess } from '@tumbaland/backend-core';
import * as tradeService from '../services/trade.service';

/** Groups the caller is working in: the query group, or personal. */
function contextGroups(req: Request): string[] {
  const { groupId } = req.query;
  if (!groupId) return [];

  const userGroups = req.userGroups || [];
  if (!userGroups.includes(groupId as string)) {
    throw new ForbiddenError('Access denied');
  }
  return [groupId as string];
}

export const getTrades = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { ticker } = req.query;

  const trades = await tradeService.getTrades(
    user.id,
    contextGroups(req),
    ticker ? String(ticker) : undefined
  );

  sendSuccess(res, trades);
};

/** The replayed position for one ticker: quantity, cost basis, realized P/L. */
export const getPosition = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { ticker } = req.params;

  const position = await tradeService.getPosition(ticker as string, user.id, contextGroups(req));

  sendSuccess(res, { ticker: (ticker as string).toUpperCase(), ...position });
};

export const addTrade = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await tradeService.createTrade(req.body, user.id, userGroups);

  sendSuccess(res, created, 'Trade recorded', 201);
};

export const editTrade = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await tradeService.updateTrade(id as string, req.body, user.id, userGroups);

  sendSuccess(res, updated, 'Trade updated');
};

export const removeTrade = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await tradeService.deleteTrade(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Trade deleted');
};
