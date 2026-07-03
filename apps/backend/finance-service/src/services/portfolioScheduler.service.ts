import cron from 'node-cron';
import { logger } from '@tumbaland/core';
import TrackedTicker from '../models/TrackedTicker';
import { fetchAndSaveAllStockHistory } from './alphaVantage.service';

// Alpha Vantage free plan: 5 requests/minute → 12s between calls
const RATE_LIMIT_DELAY_MS = 12_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function startDailyPortfolioUpdate() {
  // Runs every day at 19:00 (7 PM).
  // Uses TIME_SERIES_DAILY compact (last ~100 trading days) so any gaps from
  // missed cron runs are automatically backfilled on the next successful run.
  cron.schedule('0 19 * * *', async () => {
    let updated = 0;
    let skipped = 0;

    try {
      const trackedTickers = await TrackedTicker.find({ isActive: true });
      logger.info('Daily price update starting', { tickerCount: trackedTickers.length });

      for (let i = 0; i < trackedTickers.length; i++) {
        const ticker = trackedTickers[i].ticker;

        try {
          const saved = await fetchAndSaveAllStockHistory(ticker);
          logger.info('Updated ticker', { ticker, recordsUpserted: saved });
          updated++;
        } catch (tickerErr) {
          logger.error('Failed to update ticker', { ticker, error: (tickerErr as Error)?.message });
          skipped++;
        }

        // Respect rate limit between calls (skip delay after last ticker)
        if (i < trackedTickers.length - 1) {
          await sleep(RATE_LIMIT_DELAY_MS);
        }
      }
    } catch (err) {
      logger.error('Portfolio update job failed', { error: (err as Error)?.message });
    }

    logger.info('Daily update complete', { updated, skipped });
  });
}
