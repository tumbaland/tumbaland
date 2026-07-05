import { Request, Response } from 'express';
import { ForbiddenError, sendSuccess, sendError } from '@tumbaland/core';
import * as holdingService from '../services/holding.service';

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

  sendSuccess(res, holdings);
};

/**
 * Create holding (also starts tracking its ticker for daily prices)
 */
export const addHolding = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await holdingService.createHolding(req.body, user.id, userGroups);

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
