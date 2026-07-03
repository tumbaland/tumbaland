import { Request, Response } from 'express';
import { ForbiddenError } from '@tumbaland/core';
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

  res.json({
    success: true,
    data: portfolios
  });
};

/**
 * Create user portfolio
 */
export const addUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const created = await createUserPortfolio(req.body, user.id, userGroups);

  res.status(201).json({
    success: true,
    message: 'Portfolio created successfully',
    data: created
  });
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
    res.status(404).json({
      success: false,
      message: 'Portfolio not found'
    });
    return;
  }

  res.json({
    success: true,
    message: 'Portfolio updated successfully',
    data: updated
  });
};

/**
 * Delete user portfolio
 */
export const removeUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  await deleteUserPortfolio(id as string, user.id, userGroups);

  res.json({
    success: true,
    message: 'Portfolio deleted successfully'
  });
};
