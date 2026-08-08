// The job body is exported and exercised directly, so the schedule mock only
// needs to record that a job was registered.
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

jest.mock('../models/TrackedTicker', () => ({ __esModule: true, default: { distinct: jest.fn() } }));
jest.mock('./alphaVantage.service', () => ({ fetchAndSaveAllStockHistory: jest.fn() }));
jest.mock('./apiQuota.service', () => ({ getRemainingQuota: jest.fn() }));
jest.mock('./fxRate.service', () => ({
  BASE_CURRENCY: 'EUR',
  refreshRate: jest.fn()
}));

import cron from 'node-cron';
import TrackedTicker from '../models/TrackedTicker';
import { fetchAndSaveAllStockHistory } from './alphaVantage.service';
import { getRemainingQuota } from './apiQuota.service';
import { refreshRate } from './fxRate.service';
import { startDailyPortfolioUpdate, runDailyPortfolioUpdate } from './portfolioScheduler.service';

const mockedDistinct = TrackedTicker.distinct as unknown as jest.Mock;
const mockedFetchHistory = fetchAndSaveAllStockHistory as jest.Mock;
const mockedQuota = getRemainingQuota as jest.Mock;
const mockedRefreshRate = refreshRate as jest.Mock;

/**
 * `distinct` is called for tickers and again for currencies; this drives both
 * from one place so a test only states what it cares about.
 */
const withTrackedData = (tickers: string[], currencies: string[] = []) => {
  mockedDistinct.mockImplementation((field: string) =>
    Promise.resolve(field === 'ticker' ? tickers : currencies)
  );
};

/** Run the job to completion, letting the inter-call delays elapse instantly. */
const runJob = async (run: Promise<void>) => {
  await jest.runAllTimersAsync();
  return run;
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockedQuota.mockResolvedValue({ limit: 25, used: 0, remaining: 25, date: '2026-08-06' });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('startDailyPortfolioUpdate', () => {
  it('registers a cron job for 22:00 daily', () => {
    startDailyPortfolioUpdate();
    expect(cron.schedule).toHaveBeenCalledWith('0 22 * * *', runDailyPortfolioUpdate);
  });
});

describe('runDailyPortfolioUpdate', () => {
  it('updates every active tracked ticker, respecting the rate-limit delay between calls', async () => {
    withTrackedData(['AAPL', 'MSFT']);
    mockedFetchHistory.mockResolvedValue(10);

    await runJob(runDailyPortfolioUpdate());

    expect(mockedDistinct).toHaveBeenCalledWith('ticker', { isActive: true });
    expect(mockedFetchHistory).toHaveBeenCalledWith('AAPL');
    expect(mockedFetchHistory).toHaveBeenCalledWith('MSFT');
  });

  it('fetches a ticker once however many users track it', async () => {
    // `distinct` collapses the tracking rows, so the same instrument tracked by
    // a user and by their group costs one call, not two.
    withTrackedData(['AAPL']);
    mockedFetchHistory.mockResolvedValue(10);

    await runJob(runDailyPortfolioUpdate());

    expect(mockedFetchHistory).toHaveBeenCalledTimes(1);
  });

  it('stops once the daily quota is spent instead of failing every remaining call', async () => {
    withTrackedData(['A', 'B', 'C', 'D']);
    mockedQuota.mockResolvedValue({ limit: 25, used: 23, remaining: 2, date: '2026-08-06' });
    mockedFetchHistory.mockResolvedValue(1);

    await runJob(runDailyPortfolioUpdate());

    expect(mockedFetchHistory).toHaveBeenCalledTimes(2);
    expect(mockedFetchHistory).toHaveBeenCalledWith('A');
    expect(mockedFetchHistory).not.toHaveBeenCalledWith('C');
  });

  it('reserves quota for the FX pairs before spending it on prices', async () => {
    withTrackedData(['A', 'B', 'C'], ['USD']);
    mockedQuota.mockResolvedValue({ limit: 25, used: 22, remaining: 3, date: '2026-08-06' });
    mockedFetchHistory.mockResolvedValue(1);

    await runJob(runDailyPortfolioUpdate());

    // 3 remaining − 1 FX pair = 2 tickers
    expect(mockedFetchHistory).toHaveBeenCalledTimes(2);
    expect(mockedRefreshRate).toHaveBeenCalledWith('USD', 'EUR');
  });

  it('refreshes only the currencies actually in use', async () => {
    withTrackedData(['AAPL'], ['USD', 'GBP']);
    mockedFetchHistory.mockResolvedValue(1);

    await runJob(runDailyPortfolioUpdate());

    expect(mockedDistinct).toHaveBeenCalledWith('currency', {
      isActive: true,
      currency: { $nin: [null, '', 'EUR'] }
    });
    expect(mockedRefreshRate).toHaveBeenCalledTimes(2);
  });

  it('continues with remaining tickers when one fails', async () => {
    withTrackedData(['BAD', 'AAPL']);
    mockedFetchHistory.mockRejectedValueOnce(new Error('rate limited')).mockResolvedValueOnce(5);

    await expect(runJob(runDailyPortfolioUpdate())).resolves.toBeUndefined();

    expect(mockedFetchHistory).toHaveBeenCalledTimes(2);
  });

  it('continues when an FX refresh fails', async () => {
    withTrackedData(['AAPL'], ['USD']);
    mockedFetchHistory.mockResolvedValue(1);
    mockedRefreshRate.mockRejectedValue(new Error('provider down'));

    await expect(runJob(runDailyPortfolioUpdate())).resolves.toBeUndefined();
  });

  it('logs and does not throw when fetching tracked tickers itself fails', async () => {
    mockedDistinct.mockRejectedValue(new Error('db down'));

    await expect(runDailyPortfolioUpdate()).resolves.toBeUndefined();
  });

  it('does nothing (no error) when there are no active tracked tickers', async () => {
    withTrackedData([]);

    await expect(runJob(runDailyPortfolioUpdate())).resolves.toBeUndefined();
    expect(mockedFetchHistory).not.toHaveBeenCalled();
  });
});
