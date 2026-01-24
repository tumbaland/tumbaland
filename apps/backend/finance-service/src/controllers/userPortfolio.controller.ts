import { Request, Response } from 'express';
import {
  getAllUserPortfolios,
  createUserPortfolio,
  updateUserPortfolio,
  deleteUserPortfolio
} from '../services/userPortfolio.service';
import { UserPortfolioResponse, ErrorResponse } from '../types/userPortfolio.types';
import { canAccessResource } from '../utils/permissionUtils';

// GET /api/user-portfolio
export const getUserPortfolios = async (req: Request, res: Response<UserPortfolioResponse[] | ErrorResponse>) => {
  try {
    const { groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    
    let portfolios;
    if (groupId) {
      // Get portfolios for specific group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      portfolios = await getAllUserPortfolios(user.id, [groupId as string]);
    } else {
      // No groupId specified: show only personal portfolios (no group)
      portfolios = await getAllUserPortfolios(user.id, []);
    }
    
    const response: UserPortfolioResponse[] = portfolios.map((p) => ({
      _id: p._id?.toString(),
      ticker: p.symbol,
      quantity: p.quantity,
      avgBuyPrice: p.avgBuyPrice,
      buyDate: p.buyDate ? p.buyDate.toISOString().split('T')[0] : undefined,
      notes: p.notes,
      latestPrice: p.latestPrice,
      athPrice: p.athPrice,
      currentValue: p.currentValue,
      valueIncrease: p.valueIncrease,
      percentIncrease: p.percentIncrease
    }));
    res.json(response);
  } catch (err) {
    if ((err as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(500).json({ error: 'Failed to fetch user portfolio' });
    }
  }
};

// POST /api/user-portfolio
export const addUserPortfolio = async (req: Request, res: Response<UserPortfolioResponse | ErrorResponse>) => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { ticker, quantity, avgBuyPrice, buyDate, notes, groupId } = req.body;
    
    const created = await createUserPortfolio({
      symbol: ticker,
      quantity,
      avgBuyPrice,
      buyDate,
      notes,
      groupId
    }, user.id, userGroups);
    
    const response: UserPortfolioResponse = {
      ticker: created.symbol,
      quantity: created.quantity,
      avgBuyPrice: created.avgBuyPrice,
      buyDate: created.buyDate ? created.buyDate.toISOString().split('T')[0] : undefined,
      notes: created.notes
    };
    res.status(201).json(response);
  } catch (err) {
    if ((err as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: 'Failed to add portfolio entry' });
    }
  }
};

// PUT /api/user-portfolio/:id
export const editUserPortfolio = async (req: Request, res: Response<UserPortfolioResponse | ErrorResponse>) => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;
    const { ticker, quantity, avgBuyPrice, buyDate, notes, groupId } = req.body;
    
    const updated = await updateUserPortfolio(id as string, {
      symbol: ticker,
      quantity,
      avgBuyPrice,
      buyDate,
      notes,
      groupId
    }, user.id, userGroups);
    
    if (!updated) return res.status(404).json({ error: 'Portfolio entry not found' });
    
    const response: UserPortfolioResponse = {
      ticker: updated.symbol,
      quantity: updated.quantity,
      avgBuyPrice: updated.avgBuyPrice,
      buyDate: updated.buyDate ? updated.buyDate.toISOString().split('T')[0] : undefined,
      notes: updated.notes
    };
    res.status(200).json(response);
  } catch (err) {
    if ((err as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: 'Failed to update portfolio entry' });
    }
  }
};

// DELETE /api/user-portfolio/:id
export const removeUserPortfolio = async (req: Request, res: Response<ErrorResponse>) => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { id } = req.params;
    
    await deleteUserPortfolio(id as string, user.id, userGroups);
    res.status(204).send();
  } catch (err) {
    if ((err as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: 'Failed to delete portfolio entry' });
    }
  }
};
