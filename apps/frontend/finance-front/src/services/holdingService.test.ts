import { vi } from 'vitest';
import { getHoldings, addHolding, updateHolding, deleteHolding } from './holdingService';

function mockFetchOnce(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = init;
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok, status, json: async () => body } as Response);
}

describe('holdingService', () => {
  it('fetches holdings scoped to a group', async () => {
    mockFetchOnce({ success: true, data: [{ _id: 'h1', ticker: 'AAPL' }] });

    const result = await getHoldings('group-1');

    expect(result).toEqual([{ _id: 'h1', ticker: 'AAPL' }]);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/holdings?groupId=group-1');
  });

  it('fetches all holdings when no group is given', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getHoldings();

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain('groupId');
  });

  it('creates a holding', async () => {
    mockFetchOnce({ success: true, data: { _id: 'h2', ticker: 'MSFT' } });

    const result = await addHolding({ ticker: 'MSFT', quantity: 1, avgBuyPrice: 100 });

    expect(result).toEqual({ _id: 'h2', ticker: 'MSFT' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('updates a holding', async () => {
    mockFetchOnce({ success: true, data: { _id: 'h1', quantity: 5 } });

    const result = await updateHolding('h1', { quantity: 5 });

    expect(result).toEqual({ _id: 'h1', quantity: 5 });
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/holdings/h1');
    expect(init).toMatchObject({ method: 'PUT' });
  });

  it('deletes a holding', async () => {
    mockFetchOnce({ success: true });

    await deleteHolding('h1');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/holdings/h1');
    expect(init).toMatchObject({ method: 'DELETE' });
  });
});
