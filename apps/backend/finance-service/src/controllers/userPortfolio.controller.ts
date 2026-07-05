import { Request, Response } from 'express';
import { ForbiddenError, sendSuccess, sendError } from '@tumbaland/core';
import {
  getAllUserPortfolios,
  createUserPortfolio,
  updateUserPortfolio,
  deleteUserPortfolio
} from '../services/userPortfolio.service';

/**
 * Get user portfolios
 */
export const getUserPortfolios = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { groupId } = req.query;

  let portfolios;
  if (groupId) {
    // Get portfolios for specific group (user must be member)
    if (!userGroups.includes(groupId as string)) {
      throw new ForbiddenError('Access denied');
    }
    portfolios = await getAllUserPortfolios(user.id, [groupId as string]);
  } else {
    // No groupId specified: show only personal portfolios (no group)
    portfolios = await getAllUserPortfolios(user.id, []);
  }

  sendSuccess(res, portfolios);
};

/**
 * Create user portfolio
 */
export const addUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await createUserPortfolio(req.body, user.id, userGroups);

  sendSuccess(res, created, 'Portfolio created successfully', 201);
};

/**
 * Update user portfolio
 */
export const editUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  const updated = await updateUserPortfolio(id as string, req.body, user.id, userGroups);

  if (!updated) {
    sendError(res, 'Portfolio not found', 404);
    return;
  }

  sendSuccess(res, updated, 'Portfolio updated successfully');
};

/**
 * Delete user portfolio
 */
export const removeUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await deleteUserPortfolio(id as string, user.id, userGroups);

  sendSuccess(res, undefined, 'Portfolio deleted successfully');
};
