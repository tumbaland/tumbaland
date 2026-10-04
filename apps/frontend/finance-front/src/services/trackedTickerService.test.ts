import { vi } from 'vite-plus/test';
import {
  getTrackedTickers,
  addTrackedTicker,
  updateTrackedTicker,
  deleteTrackedTicker,
  searchTickers
} from './trackedTickerService';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

describe('trackedTickerService', () => {
  it('fetches tracked tickers scoped to a group', async () => {
    mockFetchOnce({ success: true, data: [{ _id: 't1', ticker: 'AAPL' }] });

    const result = await getTrackedTickers('group-1');

    expect(result).toEqual([{ _id: 't1', ticker: 'AAPL' }]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/tracked-tickers?groupId=group-1');
  });

  it('fetches all tracked tickers when no group is given', async () => {
    mockFetchOnce({ success: true, data: [] });
    await getTrackedTickers();
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/tracked-tickers');
    expect(String(url)).not.toContain('?');
  });

  it('adds a tracked ticker', async () => {
    mockFetchOnce({ success: true, data: { _id: 't1', ticker: 'AAPL', displayName: 'Apple', isActive: true } });

    const result = await addTrackedTicker({ ticker: 'AAPL', displayName: 'Apple', isActive: true });

    expect(result).toMatchObject({ ticker: 'AAPL' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('updates a tracked ticker', async () => {
    mockFetchOnce({ success: true, data: { _id: 't1', isActive: false } });

    await updateTrackedTicker('t1', { isActive: false });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/tracked-tickers/t1');
    expect(init).toMatchObject({ method: 'PUT' });
  });

  it('deletes a tracked ticker', async () => {
    mockFetchOnce({ success: true });
    await deleteTrackedTicker('t1');
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/tracked-tickers/t1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });

  it('searches tickers with a URL-encoded query', async () => {
    mockFetchOnce({ success: true, data: [{ symbol: 'AAPL', name: 'Apple Inc' }] });

    const result = await searchTickers('apple inc');

    expect(result).toEqual([{ symbol: 'AAPL', name: 'Apple Inc' }]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/tracked-tickers/search?q=apple%20inc');
  });
});
