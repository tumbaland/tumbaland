jest.mock('@tumbaland/backend-core', () => ({
  requireEnv: (name: string) => process.env[name] ?? 'http://finance-service:4003'
}));

import fixtures from './__fixtures__/finance-api.json';
import { finance } from './finance';

// The fixtures are real responses; financeSchemas.test.ts says why that matters.

const respond = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true, data: body })
  } as Response);

const KEY = 'tmb_live_abcdef123456_secret';

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('the client against recorded responses', () => {
  it('asks for the newest transactions first', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.transactions));

    await finance.listTransactions(KEY, { category: 'Groceries' });

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.searchParams.get('sort')).toBe('date');
    expect(url.searchParams.get('direction')).toBe('desc');
    expect(url.searchParams.get('category')).toBe('Groceries');
  });

  it('omits a filter that was not given, rather than sending it empty', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.transactions));

    await finance.listTransactions(KEY, {});

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.searchParams.has('category')).toBe(false);
    expect(url.searchParams.has('groupId')).toBe(false);
  });

  it('carries the tenant when one was resolved', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.holdings));

    await finance.listHoldings(KEY, 'g1');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.searchParams.get('groupId')).toBe('g1');
  });

  it('forwards the caller’s own credential rather than a service token', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(fixtures.holdings));

    await finance.listHoldings(KEY);

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    // A read-only key must not be widened by passing through this hop.
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
  });
});

describe('every endpoint this client speaks to', () => {
  /**
   * Path and verb per method, pinned.
   *
   * Unknown query parameters are ignored by these controllers rather than
   * rejected, so a wrong name returns a confident, unfiltered answer instead of
   * an error — which is worse than a 400 and is exactly how the relationship
   * client shipped broken the first time.
   */
  const requested = () => (global.fetch as jest.Mock).mock.calls[0][0] as URL;
  const method = () => ((global.fetch as jest.Mock).mock.calls[0][1] as RequestInit).method;

  beforeEach(() => {
    // One body that satisfies every schema in the block: this is a test about
    // paths and verbs, and the aggregate endpoints now parse what they read.
    (global.fetch as jest.Mock).mockReturnValue(
      respond({ kpis: { netWorth: 0, assets: 0, liabilities: 0 }, monthlyTotal: 0, yearlyTotal: 0 })
    );
  });

  it('reads the summary from /transactions/summary with a month window', async () => {
    await finance.getSummary(KEY, 24, 'g1');

    expect(requested().pathname).toBe('/api/transactions/summary');
    expect(requested().searchParams.get('months')).toBe('24');
    expect(requested().searchParams.get('groupId')).toBe('g1');
  });

  it('reads year-on-year trends from /transactions/analytics', async () => {
    await finance.getAnalytics(KEY, 'g1');

    expect(requested().pathname).toBe('/api/transactions/analytics');
    expect(requested().searchParams.get('groupId')).toBe('g1');
  });

  it('reads recurring payments from /transactions/recurring', async () => {
    await finance.getRecurring(KEY, 12);
    expect(requested().pathname).toBe('/api/transactions/recurring');
  });

  it('reads net worth from /dashboard', async () => {
    await finance.getDashboard(KEY);
    expect(requested().pathname).toBe('/api/dashboard');
  });

  it('reads trades from /trades', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond([]));
    await finance.listTrades(KEY);
    expect(requested().pathname).toBe('/api/trades');
  });

  it('reads categories from /transactions/categories', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond(['Groceries', 'Telecom']));

    await expect(finance.listCategories(KEY)).resolves.toEqual(['Groceries', 'Telecom']);
    expect(requested().pathname).toBe('/api/transactions/categories');
  });

  it('posts a trade to /trades', async () => {
    await finance.createTrade(KEY, { ticker: 'VWCE.DEX', type: 'buy', date: '2026-09-05' });

    expect(method()).toBe('POST');
    expect(requested().pathname).toBe('/api/trades');
  });

  it('posts a recategorisation to /transactions/recategorise', async () => {
    (global.fetch as jest.Mock).mockReturnValue(respond({ updated: 3 }));

    await expect(
      finance.recategorise(KEY, { fromCategory: 'A', toCategory: 'B' })
    ).resolves.toEqual({ updated: 3 });

    expect(method()).toBe('POST');
    expect(requested().pathname).toBe('/api/transactions/recategorise');
  });
});
