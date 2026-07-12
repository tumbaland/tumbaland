let capturedCallback: (() => Promise<void>) | undefined;

jest.mock('node-cron', () => ({
  schedule: jest.fn((_expr: string, cb: () => Promise<void>) => {
    capturedCallback = cb;
  })
}));

jest.mock('../models/TrackedTicker', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('./alphaVantage.service', () => ({ fetchAndSaveAllStockHistory: jest.fn() }));

import cron from 'node-cron';
import TrackedTicker from '../models/TrackedTicker';
import { fetchAndSaveAllStockHistory } from './alphaVantage.service';
import { startDailyPortfolioUpdate } from './portfolioScheduler.service';

const mockedFind = TrackedTicker.find as unknown as jest.Mock;
const mockedFetchHistory = fetchAndSaveAllStockHistory as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  capturedCallback = undefined;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('startDailyPortfolioUpdate', () => {
  it('registers a cron job for 19:00 daily', () => {
    startDailyPortfolioUpdate();
    expect(cron.schedule).toHaveBeenCalledWith('0 19 * * *', expect.any(Function));
  });

  it('updates every active tracked ticker, respecting the rate-limit delay between calls', async () => {
    mockedFind.mockResolvedValue([{ ticker: 'AAPL' }, { ticker: 'MSFT' }]);
    mockedFetchHistory.mockResolvedValue(10);
    startDailyPortfolioUpdate();

    const runPromise = capturedCallback!();
    await jest.runAllTimersAsync();
    await runPromise;

    expect(mockedFind).toHaveBeenCalledWith({ isActive: true });
    expect(mockedFetchHistory).toHaveBeenCalledWith('AAPL');
    expect(mockedFetchHistory).toHaveBeenCalledWith('MSFT');
  });

  it('continues with remaining tickers when one fails', async () => {
    mockedFind.mockResolvedValue([{ ticker: 'BAD' }, { ticker: 'AAPL' }]);
    mockedFetchHistory.mockRejectedValueOnce(new Error('rate limited')).mockResolvedValueOnce(5);
    startDailyPortfolioUpdate();

    const runPromise = capturedCallback!();
    await jest.runAllTimersAsync();
    await expect(runPromise).resolves.toBeUndefined();

    expect(mockedFetchHistory).toHaveBeenCalledTimes(2);
  });

  it('logs and does not throw when fetching tracked tickers itself fails', async () => {
    mockedFind.mockRejectedValue(new Error('db down'));
    startDailyPortfolioUpdate();

    await expect(capturedCallback!()).resolves.toBeUndefined();
  });

  it('does nothing (no error) when there are no active tracked tickers', async () => {
    mockedFind.mockResolvedValue([]);
    startDailyPortfolioUpdate();

    await expect(capturedCallback!()).resolves.toBeUndefined();
    expect(mockedFetchHistory).not.toHaveBeenCalled();
  });
});
