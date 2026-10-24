import { Request, Response } from 'express';
import { BadRequestError, getGroupOwner, logger, retentionFloor, sendSuccess } from '@tumbaland/backend-core';
import * as tickerPriceService from '../services/tickerPriceHistory.service';
import { PriceInterval } from '../models/TickerPriceHistory';
import { getRemainingQuota } from '../services/apiQuota.service';

/**
 * Whose retention applies to this read: the caller, plus the owners of any
 * groups whose tickers are in scope.
 *
 * Price rows are shared market data scoped by the *tracked ticker* list, so a
 * group-context read returns the group's instruments. Resolving retention from
 * the caller alone would show a free member of a paid Family group ninety days
 * of a household's history the household paid to keep — `retentionFloor` takes
 * the most generous of the subjects for exactly that reason.
 *
 * A group whose owner cannot be resolved is skipped rather than failing the
 * read: history is a *read*, and reads are never gated to the point of denial.
 * The caller is always in the list, so the floor degrades to their own plan.
 */
async function retentionSubjects(req: Request): Promise<string[]> {
  const caller = req.user?.email;
  const subjects = new Set<string>(caller ? [caller.toLowerCase()] : []);

  for (const groupId of req.userGroups ?? []) {
    try {
      const owner = await getGroupOwner(groupId);
      if (owner) subjects.add(owner.ownerEmail);
    } catch (err) {
      logger.warn('Could not resolve group owner for retention', {
        groupId,
        error: (err as Error)?.message
      });
    }
  }

  return Array.from(subjects);
}

function parseDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) return undefined;
  const date = new Date(typeof value === 'string' ? value : NaN);
  if (isNaN(date.getTime())) {
    throw new BadRequestError(`${field} must be a valid date`);
  }
  return date;
}

/**
 * Rejects an unknown interval rather than silently serving the default: a
 * caller asking for `weekly` and receiving daily closes would annualize them
 * with the wrong factor and never know.
 */
function parseInterval(value: unknown): PriceInterval | undefined {
  if (value === undefined) return undefined;
  const interval = value;
  if (interval !== 'daily' && interval !== 'weekly') {
    throw new BadRequestError('interval must be daily or weekly');
  }
  return interval;
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
  const { ticker, from, to, limit, interval } = req.query;

  const records = await tickerPriceService.getTickerPriceHistory(user.id, userGroups, {
    ticker: typeof ticker === 'string' && ticker ? ticker : undefined,
    from: parseDate(from, 'from'),
    to: parseDate(to, 'to'),
    limit: parseLimit(limit),
    interval: parseInterval(interval),
    retentionFrom: await retentionFloor(await retentionSubjects(req))
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
 * Fetch and save the full weekly history for a ticker.
 *
 * Separate from the daily fetch because it is a different series with a
 * different meaning, not a bigger version of the same one — see
 * `fetchAndSaveWeeklyHistory`.
 */
export const fetchAndSaveWeeklyTickerHistory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];
  const { ticker } = req.body;

  const savedCount = await tickerPriceService.fetchWeeklyTickerHistory(ticker, user.id, userGroups);

  sendSuccess(res, { ticker, recordsCount: savedCount }, `Fetched ${savedCount} weekly closes for ${ticker}`);
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
 * How much history each tracked ticker has, and how fresh it is — what the
 * sync panel renders.
 */
export const getCoverage = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const userGroups = req.userGroups || [];

  const coverage = await tickerPriceService.getTickerCoverage(user.id, userGroups);

  sendSuccess(res, coverage);
};

/**
 * Remaining Alpha Vantage calls for today, so the UI can warn before a fetch
 * that would fail on quota.
 */
export const getQuota = async (_req: Request, res: Response): Promise<void> => {
  const quota = await getRemainingQuota();

  sendSuccess(res, quota);
};
