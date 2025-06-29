import { Request, Response } from 'express';
import TrackedTicker from '../models/TrackedTicker';
import {
  getAllTrackedTickers,
  createTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker
} from '../services/trackedTicker.service';
import { TrackedTickerResponse, ErrorResponse } from '../types/trackedTicker.types';

// GET /api/tracked-tickers
export const getTrackedTickers = async (req: Request, res: Response<TrackedTickerResponse[] | ErrorResponse>) => {
  try {
    const tickers = await getAllTrackedTickers();
    const response: TrackedTickerResponse[] = tickers.map(t => ({
      ticker: t.ticker,
      displayName: t.displayName,
      description: t.description,
      dateAdded: t.dateAdded.toISOString(),
      isActive: t.isActive
    }));
    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tracked tickers' });
  }
};

// POST /api/tracked-tickers
export const addTrackedTicker = async (req: Request, res: Response<TrackedTickerResponse | ErrorResponse>) => {
  try {
    const { ticker, displayName, description, isActive } = req.body;
    const created = await createTrackedTicker({ ticker, displayName, description, isActive });
    const response: TrackedTickerResponse = {
      ticker: created.ticker,
      displayName: created.displayName,
      description: created.description,
      dateAdded: created.dateAdded.toISOString(),
      isActive: created.isActive
    };
    res.status(201).json(response);
  } catch (err) {
    res.status(400).json({ error: 'Failed to add tracked ticker' });
  }
};

// PUT /api/tracked-tickers/:id
export const editTrackedTicker = async (req: Request, res: Response<TrackedTickerResponse | ErrorResponse>) => {
  try {
    const { id } = req.params;
    const { ticker, displayName, description, isActive } = req.body;
    const updated = await updateTrackedTicker(id, { ticker, displayName, description, isActive });
    if (!updated) return res.status(404).json({ error: 'Tracked ticker not found' });
    const response: TrackedTickerResponse = {
      ticker: updated.ticker,
      displayName: updated.displayName,
      description: updated.description,
      dateAdded: updated.dateAdded.toISOString(),
      isActive: updated.isActive
    };
    res.status(200).json(response);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update tracked ticker' });
  }
};

// DELETE /api/tracked-tickers/:id
export const removeTrackedTicker = async (req: Request, res: Response<ErrorResponse>) => {
  try {
    const { id } = req.params;
    await deleteTrackedTicker(id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete tracked ticker' });
  }
};
