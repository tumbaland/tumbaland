import cron from 'node-cron';
import { logger } from '@tumbaland/backend-core';
import TrackedTicker from '../models/TrackedTicker';
import { fetchAndSaveAllStockHistory } from './alphaVantage.service';
import { getRemainingQuota } from './apiQuota.service';
import { BASE_CURRENCY, refreshRate } from './fxRate.service';

// Alpha Vantage's free plan also caps bursts, so calls are spaced out even when
// the daily quota has room.
const RATE_LIMIT_DELAY_MS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Currencies that holdings are actually quoted in, so FX is refreshed only for
 * pairs in use.
 */
async function currenciesInUse(): Promise<string[]> {
  const currencies: string[] = await TrackedTicker.distinct('currency', {
    isActive: true,
    currency: { $nin: [null, '', BASE_CURRENCY] }
  });
  return currencies.filter(Boolean);
}

export async function runDailyPortfolioUpdate(): Promise<void> {
  let updated = 0;
  let skipped = 0;
  let quotaExhausted = false;

  try {
    // The same instrument tracked by several users (or by a user and a group)
    // is one price series — fetching it once per tracking row multiplied the
    // quota spend by the number of trackers for no extra data.
    const tickers: string[] = await TrackedTicker.distinct('ticker', { isActive: true });
    const { remaining, limit } = await getRemainingQuota();

    // Leave room for the FX pairs, which are useless without a rate but cheap.
    const fxCurrencies = await currenciesInUse();
    const budget = Math.max(0, remaining - fxCurrencies.length);

    logger.info('Daily price update starting', {
      tickerCount: tickers.length,
      quotaRemaining: remaining,
      dailyLimit: limit,
      priceBudget: budget
    });

    for (let i = 0; i < tickers.length; i++) {
      if (i >= budget) {
        // Stopping deliberately beats letting every remaining call fail on the
        // provider's throttle response and logging a wall of errors.
        quotaExhausted = true;
        skipped += tickers.length - i;
        break;
      }

      const ticker = tickers[i];
      try {
        const saved = await fetchAndSaveAllStockHistory(ticker);
        logger.info('Updated ticker', { ticker, recordsUpserted: saved });
        updated++;
      } catch (tickerErr) {
        logger.error('Failed to update ticker', { ticker, error: (tickerErr as Error)?.message });
        skipped++;
      }

      // Respect the burst limit between calls (skip delay after the last one)
      if (i < tickers.length - 1) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    for (const currency of fxCurrencies) {
      try {
        await refreshRate(currency, BASE_CURRENCY);
      } catch (fxErr) {
        logger.error('Failed to refresh FX rate', { currency, error: (fxErr as Error)?.message });
      }
      await sleep(RATE_LIMIT_DELAY_MS);
    }
  } catch (err) {
    logger.error('Portfolio update job failed', { error: (err as Error)?.message });
  }

  logger.info('Daily update complete', { updated, skipped, quotaExhausted });
}

export function startDailyPortfolioUpdate() {
  // Runs every day at 19:00 (7 PM).
  // Uses TIME_SERIES_DAILY compact (last ~100 trading days) so any gaps from
  // missed cron runs are automatically backfilled on the next successful run.
  cron.schedule('0 19 * * *', runDailyPortfolioUpdate);
}
