import { Request, Response } from 'express';
import {
  getAllUserPortfolios,
  createUserPortfolio,
  updateUserPortfolio,
  deleteUserPortfolio
} from '../services/userPortfolio.service';
import { UserPortfolioResponse, ErrorResponse } from '../types/userPortfolio.types';

// GET /api/user-portfolio
export const getUserPortfolios = async (req: Request, res: Response<UserPortfolioResponse[] | ErrorResponse>) => {
  try {
    const portfolios = await getAllUserPortfolios();
    const response: UserPortfolioResponse[] = portfolios.map(p => ({
      _id: p._id?.toString(),
      ticker: p.symbol, // assuming symbol is still used in model, otherwise use p.ticker
      quantity: p.quantity,
      avgBuyPrice: p.avgBuyPrice,
      buyDate: p.buyDate ? p.buyDate.toISOString().split('T')[0] : undefined,
      notes: p.notes,
      latestPrice: p.latestPrice,
      currentValue: p.currentValue,
      valueIncrease: p.valueIncrease,
      percentIncrease: p.percentIncrease
    }));
    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user portfolio' });
  }
};

// POST /api/user-portfolio
export const addUserPortfolio = async (req: Request, res: Response<UserPortfolioResponse | ErrorResponse>) => {
  try {
    const { ticker, quantity, avgBuyPrice, buyDate, notes } = req.body;
    const created = await createUserPortfolio({ symbol: ticker, quantity, avgBuyPrice, buyDate, notes });
    const response: UserPortfolioResponse = {
      ticker: created.symbol,
      quantity: created.quantity,
      avgBuyPrice: created.avgBuyPrice,
      buyDate: created.buyDate ? created.buyDate.toISOString().split('T')[0] : undefined,
      notes: created.notes
    };
    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ error: 'Failed to add portfolio entry' });
  }
};

// PUT /api/user-portfolio/:id
export const editUserPortfolio = async (req: Request, res: Response<UserPortfolioResponse | ErrorResponse>) => {
  try {
    const { id } = req.params;
    const { ticker, quantity, avgBuyPrice, buyDate, notes } = req.body;
    const updated = await updateUserPortfolio(id, { symbol: ticker, quantity, avgBuyPrice, buyDate, notes });
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
    res.status(400).json({ error: 'Failed to update portfolio entry' });
  }
};

// DELETE /api/user-portfolio/:id
export const removeUserPortfolio = async (req: Request, res: Response<ErrorResponse>) => {
  try {
    const { id } = req.params;
    await deleteUserPortfolio(id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete portfolio entry' });
  }
};
