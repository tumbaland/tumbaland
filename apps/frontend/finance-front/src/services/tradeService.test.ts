import { vi } from 'vite-plus/test';
import {
  getTrades,
  getPosition,
  addTrade,
  updateTrade,
  deleteTrade,
  isShareTrade,
  tradeValue,
  Trade
} from './tradeService';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

const trade = (overrides: Partial<Trade> = {}): Trade => ({
  ticker: 'AAPL',
  type: 'buy',
  date: '2024-01-01',
  quantity: 10,
  price: 100,
  amount: 0,
  fees: 0,
  ...overrides
});

describe('tradeService', () => {
  it('fetches trades with no filters', async () => {
    mockFetchOnce({ success: true, data: [trade()] });

    const result = await getTrades();

    expect(result).toHaveLength(1);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/trades');
    expect(String(url)).not.toContain('ticker=');
  });

  it('narrows by group and ticker', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getTrades('g1', 'AAPL');

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('groupId=g1');
    expect(String(url)).toContain('ticker=AAPL');
  });

  it('reads the replayed position for a ticker', async () => {
    mockFetchOnce({ success: true, data: { ticker: 'AAPL', quantity: 10 } });

    const position = await getPosition('AAPL');

    expect(position.quantity).toBe(10);
    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/trades/position/AAPL');
  });

  it('passes the group when reading a position', async () => {
    mockFetchOnce({ success: true, data: {} });

    await getPosition('AAPL', 'g1');

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('groupId=g1');
  });

  it('posts a new trade', async () => {
    mockFetchOnce({ success: true, data: trade() });

    await addTrade({ ticker: 'AAPL', type: 'buy', date: '2024-01-01', quantity: 10, price: 100 });

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/trades');
    expect(JSON.parse(init!.body as string)).toMatchObject({ ticker: 'AAPL', quantity: 10 });
  });

  it('puts an updated trade', async () => {
    mockFetchOnce({ success: true, data: trade({ quantity: 5 }) });

    await updateTrade('t1', { quantity: 5 });

    const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/trades/t1');
  });

  it('deletes a trade', async () => {
    mockFetchOnce({ success: true });

    await deleteTrade('t1');

    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toContain('/trades/t1');
    expect(init!.method).toBe('DELETE');
  });
});

describe('isShareTrade', () => {
  it('is true for the types that move shares', () => {
    expect(isShareTrade('buy')).toBe(true);
    expect(isShareTrade('sell')).toBe(true);
  });

  it('is false for plain cash events', () => {
    expect(isShareTrade('dividend')).toBe(false);
    expect(isShareTrade('fee')).toBe(false);
  });
});

describe('tradeValue', () => {
  it('multiplies quantity by price for a share trade', () => {
    expect(tradeValue(trade({ quantity: 10, price: 100 }))).toBe(1000);
  });

  it('uses the cash amount for a dividend', () => {
    expect(tradeValue(trade({ type: 'dividend', quantity: 0, price: 0, amount: 45 }))).toBe(45);
  });
});
