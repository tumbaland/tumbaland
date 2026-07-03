import { Request, Response } from 'express';
import { BadRequestError } from '@tumbaland/core';
import * as tickerPriceService from '../services/tickerPriceHistory.service';

/**
 * Get all ticker price history records
 */
export const getTickerPriceHistory = async (req: Request, res: Response): Promise<void> => {
  const records = await tickerPriceService.getTickerPriceHistory();

  res.json({
    success: true,
    data: records
  });
};

/**
 * Fetch and save latest ticker prices
 */
export const fetchAndSaveTickerPrices = async (req: Request, res: Response): Promise<void> => {
  const { ticker } = req.body;

  const results = await tickerPriceService.fetchAndSaveTickerPrices(ticker);

  res.json({
    success: true,
    message: 'Prices fetched and saved',
    data: results
  });
};

/**
 * Fetch and save all historic prices for a ticker
 */
export const fetchAndSaveAllTickerHistory = async (req: Request, res: Response): Promise<void> => {
  const { ticker } = req.body;

  if (!ticker) {
    throw new BadRequestError('Missing ticker in request body');
  }

  const savedCount = await tickerPriceService.fetchAllTickerHistory(ticker);

  res.json({
    success: true,
    message: `Fetched and saved ${savedCount} records for ${ticker}`,
    data: { ticker, recordsCount: savedCount }
  });
};

/**
 * Delete ticker price history record
 */
export const deleteTickerPriceHistory = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    throw new BadRequestError('Missing ID in request');
  }

  await tickerPriceService.deleteTickerPriceRecord(id as string);

  res.json({
    success: true,
    message: 'Price history record deleted successfully',
    data: { id }
  });
};
