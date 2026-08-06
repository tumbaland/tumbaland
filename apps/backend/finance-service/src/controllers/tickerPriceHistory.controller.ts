import { Request, Response } from 'express';
import { BadRequestError, sendSuccess } from '@tumbaland/backend-core';
import * as tickerPriceService from '../services/tickerPriceHistory.service';
import { getRemainingQuota } from '../services/apiQuota.service';

function parseDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(String(value));
  if (isNaN(date.getTime())) {
    throw new BadRequestError(`${field} must be a valid date`);
  }
  return date;
}

function parseLimit(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new BadRequestError('limit must be a positive integer');
  }
  return limit;
}

/**
 * Get price history for the caller's tracked tickers, optionally narrowed by
 * ticker and date range.
 */
export const getTickerPriceHistory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { ticker, from, to, limit } = req.query;

  const records = await tickerPriceService.getTickerPriceHistory(user.id, userGroups, {
    ticker: ticker ? String(ticker) : undefined,
    from: parseDate(from, 'from'),
    to: parseDate(to, 'to'),
    limit: parseLimit(limit)
  });

  sendSuccess(res, records);
};

/**
 * Fetch and save latest ticker prices
 */
export const fetchAndSaveTickerPrices = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { ticker } = req.body;

  const results = await tickerPriceService.fetchAndSaveTickerPrices(ticker, user.id, userGroups);

  sendSuccess(res, results, 'Prices fetched and saved');
};

/**
 * Fetch and save all historic prices for a ticker
 */
export const fetchAndSaveAllTickerHistory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { ticker } = req.body;

  const savedCount = await tickerPriceService.fetchAllTickerHistory(ticker, user.id, userGroups);

  sendSuccess(res, { ticker, recordsCount: savedCount }, `Fetched and saved ${savedCount} records for ${ticker}`);
};

/**
 * Delete ticker price history record
 */
export const deleteTickerPriceHistory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { id } = req.params;

  if (!id) {
    throw new BadRequestError('Missing ID in request');
  }

  await tickerPriceService.deleteTickerPriceRecord(id as string, user.id, userGroups);

  sendSuccess(res, { id }, 'Price history record deleted successfully');
};

/**
 * Remaining Alpha Vantage calls for today, so the UI can warn before a fetch
 * that would fail on quota.
 */
export const getQuota = async (_req: Request, res: Response): Promise<void> => {
  const quota = await getRemainingQuota();

  sendSuccess(res, quota);
};
