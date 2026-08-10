import dotenv from 'dotenv';

dotenv.config();

import mongoose from 'mongoose';
import { logger } from '@tumbaland/backend-core';
import TrackedTicker from '../models/TrackedTicker';
import TickerPriceHistory from '../models/TickerPriceHistory';
import { fetchAndSaveWeeklyHistory } from '../services/alphaVantage.service';
import { getRemainingQuota, DAILY_LIMIT } from '../services/apiQuota.service';

/**
 * Seed every tracked instrument with its full weekly price history.
 *
 * **Why weekly.** The free Alpha Vantage tier caps `TIME_SERIES_DAILY` at the
 * compact ~100 trading days, and `outputsize=full` is refused outright as a
 * premium feature. `TIME_SERIES_WEEKLY` returns the entire series — a decade or
 * more — for the same one call. A covariance estimated from ten years of weekly
 * closes beats one from five months of daily closes on every axis that matters,
 * and this is the only free route to it.
 *
 * One call per symbol, spent through the same `apiusages` ledger the rest of the
 * service uses, so the daily budget stays honest and a run that would exceed it
 * stops instead of failing halfway.
 *
 *   npm run backfill:weekly --workspace=finance-service                    # dry run
 *   npm run backfill:weekly --workspace=finance-service -- --apply
 *   npm run backfill:weekly --workspace=finance-service -- --ticker=VUSA.DEX --apply
 *   npm run backfill:weekly --workspace=finance-service -- --apply --force
 *
 * `--force` re-fetches symbols that already have weekly rows; without it they
 * are skipped, because the whole point is that this need only run once per
 * symbol and API calls are the scarce resource.
 *
 * Lives under `src/` for the same reason as payment-service's reconcile CLI:
 * `rootDir` covers it, `npm run typecheck` catches drift, and it compiles into
 * the image so a production backfill is `node dist/scripts/backfill-weekly-history.js`.
 */

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('MONGODB_URI is not set in the environment.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const force = argv.includes('--force');
const onlyTicker = argv.find(a => a.startsWith('--ticker='))?.split('=')[1];

/**
 * The free tier also caps requests per minute, well below its daily allowance,
 * so a tight loop trips a rate limit that costs a call and returns nothing.
 * Spacing them is cheaper than retrying them.
 */
const PACING_MS = 15_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function run(): Promise<void> {
  await mongoose.connect(mongoUri as string);

  try {
    const symbols: string[] = onlyTicker
      ? [onlyTicker]
      : (await TrackedTicker.distinct('ticker', { isActive: true })).sort();

    if (symbols.length === 0) {
      console.log('No active tracked tickers.');
      return;
    }

    // What each symbol already holds, so a re-run costs nothing.
    const existing = new Map<string, number>();
    for (const symbol of symbols) {
      existing.set(symbol, await TickerPriceHistory.countDocuments({ ticker: symbol, interval: 'weekly' }));
    }

    const todo = symbols.filter(s => force || (existing.get(s) ?? 0) === 0);
    const quota = await getRemainingQuota();

    console.log(`${symbols.length} active symbol(s); ${todo.length} need a weekly fetch.`);
    for (const symbol of symbols) {
      const have = existing.get(symbol) ?? 0;
      const action = todo.includes(symbol) ? (have > 0 ? 're-fetch (--force)' : 'fetch') : 'skip';
      console.log(`  ${symbol.padEnd(12)} ${String(have).padStart(4)} weekly rows   → ${action}`);
    }
    console.log(`\nProvider quota: ${quota.remaining} of ${quota.limit} calls left today; this run needs ${todo.length}.`);

    if (todo.length > quota.remaining) {
      console.log(
        `Not enough quota for the whole run. It will fetch what it can and stop; re-run tomorrow for the rest.`
      );
    }

    if (!apply) {
      console.log('\nDry run. Re-run with --apply to fetch.');
      return;
    }

    let fetched = 0;
    let saved = 0;
    for (const [i, symbol] of todo.entries()) {
      try {
        const count = await fetchAndSaveWeeklyHistory(symbol);
        fetched++;
        saved += count;

        const range = await weeklyRange(symbol);
        console.log(`${symbol}: saved ${count} weekly closes${range ? ` (${range})` : ''}`);
      } catch (err) {
        // A quota or rate-limit rejection ends the run: every later symbol would
        // hit the same wall, and burning the retries makes tomorrow's run worse.
        const message = (err as Error)?.message ?? String(err);
        console.error(`${symbol}: ${message}`);
        if (/quota|rate limit|429/i.test(message)) {
          console.error('Stopping: the provider budget is exhausted. Re-run when it resets.');
          break;
        }
      }

      if (i < todo.length - 1) await sleep(PACING_MS);
    }

    console.log(`\nFetched ${fetched} of ${todo.length} symbol(s), ${saved} weekly closes written.`);
    logger.info('finance.weekly_backfill', {
      event: 'finance.weekly_backfill',
      symbols: todo.length,
      fetched,
      rows: saved
    });
  } finally {
    await mongoose.disconnect();
  }
}

/** Human-readable coverage, for the console line only. */
async function weeklyRange(symbol: string): Promise<string | null> {
  const [oldest, newest] = await Promise.all([
    TickerPriceHistory.findOne({ ticker: symbol, interval: 'weekly' }).sort({ date: 1 }).lean(),
    TickerPriceHistory.findOne({ ticker: symbol, interval: 'weekly' }).sort({ date: -1 }).lean()
  ]);
  if (!oldest || !newest) return null;

  const years = (newest.date.getTime() - oldest.date.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return `${oldest.date.toISOString().slice(0, 10)} → ${newest.date.toISOString().slice(0, 10)}, ${years.toFixed(1)} years`;
}

console.log(`Weekly history backfill — ${apply ? 'APPLY' : 'dry run'}${force ? ', forcing re-fetch' : ''}`);
console.log(`Provider allowance: ${DAILY_LIMIT} calls/day, one per symbol.\n`);

run().catch(err => {
  console.error(err);
  process.exit(1);
});
