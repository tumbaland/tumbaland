import { Request, Response } from 'express';
import { BadRequestError, sendSuccess } from '@tumbaland/backend-core';
import * as tickerPriceService from '../services/tickerPriceHistory.service';

/**
 * Get all ticker price history records
 */
export const getTickerPriceHistory = async (req: Request, res: Response): Promise<void> => {
  const records = await tickerPriceService.getTickerPriceHistory();

  sendSuccess(res, records);
};

/**
 * Fetch and save latest ticker prices
 */
export const fetchAndSaveTickerPrices = async (req: Request, res: Response): Promise<void> => {
  const { ticker } = req.body;

  const results = await tickerPriceService.fetchAndSaveTickerPrices(ticker);

  sendSuccess(res, results, 'Prices fetched and saved');
};

/**
 * Fetch and save all historic prices for a ticker
 */
export const fetchAndSaveAllTickerHistory = async (req: Request, res: Response): Promise<void> => {
  const { ticker } = req.body;

  const savedCount = await tickerPriceService.fetchAllTickerHistory(ticker);

  sendSuccess(res, { ticker, recordsCount: savedCount }, `Fetched and saved ${savedCount} records for ${ticker}`);
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

  sendSuccess(res, { id }, 'Price history record deleted successfully');
};
