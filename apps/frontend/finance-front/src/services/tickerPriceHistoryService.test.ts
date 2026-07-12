import { vi } from 'vitest';
import {
  getTickerPriceHistory,
  fetchTickerPriceHistory,
  deleteTickerPriceHistory,
  fetchAllTickerPriceHistory
} from './tickerPriceHistoryService';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, status: 200, json: async () => body } as Response);
}

describe('tickerPriceHistoryService', () => {
  it('fetches history for a ticker', async () => {
    mockFetchOnce({ success: true, data: [{ ticker: 'AAPL', date: '2024-01-01', price: 100 }] });

    const result = await getTickerPriceHistory('AAPL');

    expect(result).toEqual([{ ticker: 'AAPL', date: '2024-01-01', price: 100 }]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/ticker-price-history?ticker=AAPL');
  });

  it('fetches all history when no ticker is given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getTickerPriceHistory();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('?ticker=');
  });

  it('triggers a fetch for one ticker', async () => {
    mockFetchOnce({ success: true });
    await fetchTickerPriceHistory('AAPL');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/ticker-price-history/fetch');
    expect(JSON.parse(init!.body as string)).toEqual({ ticker: 'AAPL' });
  });

  it('triggers a full-history fetch for one ticker', async () => {
    mockFetchOnce({ success: true });
    await fetchAllTickerPriceHistory('AAPL');
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/ticker-price-history/fetch-all');
  });

  it('deletes a history entry', async () => {
    mockFetchOnce({ success: true });
    await deleteTickerPriceHistory('h1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/ticker-price-history/h1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });
});
