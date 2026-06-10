import cron from 'node-cron';
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
      console.log(`Daily price update starting for ${trackedTickers.length} tickers`);

      for (let i = 0; i < trackedTickers.length; i++) {
        const ticker = trackedTickers[i].ticker;

        try {
          const saved = await fetchAndSaveAllStockHistory(ticker);
          console.log(`Updated ${ticker}: ${saved} records upserted`);
          updated++;
        } catch (tickerErr) {
          console.error(`Failed to update ${ticker}:`, tickerErr);
          skipped++;
        }

        // Respect rate limit between calls (skip delay after last ticker)
        if (i < trackedTickers.length - 1) {
          await sleep(RATE_LIMIT_DELAY_MS);
        }
      }
    } catch (err) {
      console.error('Portfolio update job failed:', err);
    }

    console.log(`Daily update complete — updated: ${updated}, skipped: ${skipped}`);
  });
}
