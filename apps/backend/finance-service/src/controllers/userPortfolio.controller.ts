import { Request, Response } from 'express';
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
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { groupId } = req.query;

    let portfolios;
    if (groupId) {
      // Get portfolios for specific group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied'
        });
        return;
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
  } catch (error: any) {
    console.error('Error fetching user portfolios:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to fetch user portfolios'
    });
  }
};

/**
 * Create user portfolio
 */
export const addUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];

    const created = await createUserPortfolio(req.body, user.id, userGroups);

    res.status(201).json({
      success: true,
      message: 'Portfolio created successfully',
      data: created
    });
  } catch (error: any) {
    console.error('Error creating portfolio:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message.includes('required')
          ? 400
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to create portfolio'
    });
  }
};

/**
 * Update user portfolio
 */
export const editUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
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
  } catch (error: any) {
    console.error('Error updating portfolio:', error);
    const statusCode = error.message === 'ACCESS_DENIED' ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to update portfolio'
    });
  }
};

/**
 * Delete user portfolio
 */
export const removeUserPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const userGroups = req.userGroups || [];
    const { id } = req.params;

    await deleteUserPortfolio(id as string, user.id, userGroups);

    res.json({
      success: true,
      message: 'Portfolio deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting portfolio:', error);
    const statusCode =
      error.message === 'ACCESS_DENIED'
        ? 403
        : error.message === 'Portfolio not found'
          ? 404
          : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to delete portfolio'
    });
  }
};
