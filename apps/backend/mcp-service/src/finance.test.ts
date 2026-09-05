jest.mock('@tumbaland/backend-core', () => ({
  requireEnv: (name: string) => process.env[name] ?? 'http://finance-service:4003'
}));

import fixtures from './__fixtures__/finance-api.json';
import {
  analyticsSchema,
  dashboardSchema,
  finance,
  holdingSchema,
  recurringSchema,
  summarySchema,
  tradeSchema,
  transactionPageSchema
} from './finance';
import { parseResponse, ShapeError } from './schemas';

/**
 * The fixtures below are documents the live database actually holds, with free
 * text and ids replaced. Every key, type and nesting level is real.
 *
 * That is the point. Four bugs in the relationship client had one cause — the
 * client assumed a shape, the tests mocked the same assumption, and the two
 * agreed with each other while disagreeing with the service. A response taken
 * from real data cannot do that.
 */

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

describe('the recorded responses parse', () => {
  it('accepts a real /transactions page', () => {
    const page = parseResponse(transactionPageSchema, '/transactions', fixtures.transactions);

    expect(page.items.length).toBeGreaterThan(0);
    // Totals cover the filter, not the page — a caller quoting `items.length`
    // as the count would be wrong on every result with more than one page.
    expect(page.totals.count).toBeGreaterThan(page.items.length);
  });

  it('accepts real holdings, valued the way the API returns them', () => {
    // The stored document has three fields; the service adds every one that
    // makes a position worth reading. A fixture taken from the database rather
    // than the response is how the portfolio tool shipped unable to say what
    // anything was worth.
    const holdings = parseResponse(holdingSchema.array(), '/holdings', fixtures.holdings);

    expect(holdings[0]).toMatchObject({
      ticker: expect.any(String),
      currentValue: expect.any(Number),
      costBasis: expect.any(Number),
      percentIncrease: expect.any(Number)
    });
  });

  it('accepts a real /dashboard, which is what net worth is read from', () => {
    const dashboard = parseResponse(dashboardSchema, '/dashboard', fixtures.dashboard);

    expect(dashboard.kpis.netWorth).toEqual(expect.any(Number));
    expect(dashboard.allocation[0]).toMatchObject({
      name: expect.any(String),
      value: expect.any(Number)
    });
    // The cashflow block is what separates money consumed from money moved into
    // an asset, and answering "are we overspending" without it gets it wrong.
    expect(dashboard.cashflow?.trailing.consumption).toEqual(expect.any(Number));
  });

  it('accepts a real /transactions/analytics', () => {
    const analytics = parseResponse(analyticsSchema, '/transactions/analytics', fixtures.analytics);

    expect(analytics.years[0]).toMatchObject({ year: expect.any(Number) });
    expect(analytics.categoryTrends[0]).toMatchObject({
      category: expect.any(String),
      latest: expect.any(Number)
    });
  });

  it('accepts a real /transactions/recurring', () => {
    const recurring = parseResponse(recurringSchema, '/transactions/recurring', fixtures.recurring);

    expect(recurring.payments[0]).toMatchObject({
      merchant: expect.any(String),
      amount: expect.any(Number)
    });
  });

  it('accepts a real /transactions/summary', () => {
    const summary = parseResponse(summarySchema, '/transactions/summary', fixtures.summary);

    expect(summary.months[0]).toMatchObject({ month: expect.any(String), income: expect.any(Number) });
    // Per month on average, not a total for the window — the tool says so, and
    // a caller that reads it as a total is out by the length of the window.
    expect(summary.categories[0].spent).toEqual(expect.any(Number));
  });

  it('accepts a position the price job has never covered', () => {
    // Absent, not zero: a value of zero would quietly understate the portfolio.
    const holdings = parseResponse(holdingSchema.array(), '/holdings', fixtures.holdings);
    const unpriced = holdings.find((h) => h.ticker === 'UNPRICED.XX');

    expect(unpriced).toBeDefined();
    expect(unpriced!.currentValue).toBeUndefined();
    expect(unpriced!.latestPrice).toBeUndefined();
  });

  it('accepts real trades, where quantity and price are optional', () => {
    // Buys and sells carry quantity and price; dividends and fees carry a cash
    // amount instead, so neither pair can be required.
    const trades = parseResponse(tradeSchema.array(), '/trades', fixtures.trades);
    expect(trades[0].ticker).toEqual(expect.any(String));
  });
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

describe('a changed contract fails loudly', () => {
  it('rejects a bare array where a page was returned', () => {
    expect(() => parseResponse(transactionPageSchema, '/transactions', [])).toThrow(ShapeError);
  });

  it('names the field that was wrong, so the report is actionable', () => {
    try {
      parseResponse(transactionPageSchema, '/transactions', {
        items: [{ _id: 'x', amount: 1 }],
        totals: { count: 0, income: 0, expense: 0, net: 0 }
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as ShapeError).message).toContain('items.0.date');
    }
  });

  it('tolerates fields it does not know about, so the API can add them', () => {
    const withExtra = {
      ...fixtures.transactions,
      items: [{ ...fixtures.transactions.items[0], somethingNew: true }],
      brandNewTopLevelField: 42
    };

    expect(() => parseResponse(transactionPageSchema, '/transactions', withExtra)).not.toThrow();
  });

  it('reads an unfamiliar transaction type as an expense rather than failing', () => {
    // Getting one row's direction wrong is better than refusing to answer a
    // question about three thousand of them.
    const odd = {
      ...fixtures.transactions,
      items: [{ ...fixtures.transactions.items[0], type: 'transfer' }]
    };

    expect(parseResponse(transactionPageSchema, '/transactions', odd).items[0].type).toBe('expense');
  });
});
