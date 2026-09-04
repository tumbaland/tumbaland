jest.mock('@tumbaland/backend-core', () => ({
  // Tenant constants come from the real module; see the note in relationship.test.ts.
  ...jest.requireActual('@tumbaland/backend-core/dist/apiKeys/types'),
  verifyApiKey: jest.fn(),
  verifyAccessToken: jest.fn(),
  looksLikeApiKey: (t: string) => typeof t === 'string' && t.startsWith('tmb_live_'),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  requireEnv: (name: string) => process.env[name] ?? `missing:${name}`
}));

jest.mock('../finance', () => {
  const actual = jest.requireActual('../finance');
  return {
    ...actual,
    finance: {
      listTransactions: jest.fn(),
      getSummary: jest.fn(),
      getRecurring: jest.fn(),
      getDashboard: jest.fn(),
      listHoldings: jest.fn(),
      listTrades: jest.fn(),
      createTrade: jest.fn(),
      recategorise: jest.fn(),
      getAnalytics: jest.fn(),
      listCategories: jest.fn()
    }
  };
});

import request from 'supertest';
import { verifyApiKey } from '@tumbaland/backend-core';
import fixtures from '../__fixtures__/finance-api.json';
import { finance } from '../finance';
import { TumbalandError } from '../http';
import { createApp } from '../app';

const mockedVerify = verifyApiKey as jest.Mock;
const api = finance as jest.Mocked<typeof finance>;
const app = createApp();
const KEY = 'tmb_live_abcdef123456_aaaaaaaaaaaaaaaaaaaaaaaa';

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/mcp')
    .set('Authorization', `Bearer ${KEY}`)
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

  const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
  return {
    isError: Boolean(payload.result?.isError),
    text: payload.result?.content?.[0]?.text ?? ''
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedVerify.mockResolvedValue({
    ok: true,
    userId: 'u1',
    keyId: 'k1',
    scopes: ['finance:read', 'finance:write'],
    tenants: { allowed: ['personal'], default: 'personal' },
    tenantNames: { personal: 'My own data' }
  });
  api.listTransactions.mockResolvedValue(fixtures.transactions as never);
  api.listHoldings.mockResolvedValue(fixtures.holdings as never);
  api.listTrades.mockResolvedValue(fixtures.trades as never);
});

describe('search_transactions', () => {
  it('reports the totals over the whole filter, not the page it showed', async () => {
    const { text } = await callTool('search_transactions', { category: 'Groceries' });

    // Quoting the page's own sum as "the total" is the mistake a header built
    // from `items` would make on every query with more than one page.
    expect(text).toContain('7,484 matching');
    expect(text).toContain('Showing the 2 most recent');
  });

  it('reads amounts as money, with direction, and carries the id', async () => {
    const { text } = await callTool('search_transactions', {});

    expect(text).toContain('−3.98 Telecom');
    expect(text).toContain('ACME TELECOM');
    expect(text).toMatch(/\[id [a-f0-9]{24}\]/);
  });

  it('passes the filters through as the controller reads them', async () => {
    await callTool('search_transactions', {
      from: '2026-08-01',
      to: '2026-08-31',
      category: 'Groceries',
      type: 'expense',
      search: 'Selver',
      limit: 5
    });

    expect(api.listTransactions).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({
        from: '2026-08-01',
        to: '2026-08-31',
        category: 'Groceries',
        type: 'expense',
        search: 'Selver',
        limit: 5
      })
    );
  });

  it('says plainly when nothing matches', async () => {
    api.listTransactions.mockResolvedValue({
      items: [],
      totals: { count: 0, income: 0, expense: 0, net: 0 },
      hasMore: false
    } as never);

    const { text } = await callTool('search_transactions', { category: 'Nothing' });
    expect(text).toBe('No transactions match that.');
  });
});

describe('get_portfolio', () => {
  it('says what each position is worth now, not just what it cost', async () => {
    const { text } = await callTool('get_portfolio');

    // The whole point of the tool: "600 at an average of 105.77" answers what
    // was paid, and a question about the portfolio is about what it is worth.
    expect(text).toContain('worth 100,836.00');
    expect(text).toContain('cost 63,459.00');
    expect(text).toContain('up 37,377.00 (+58.9%)');
  });

  it('leads with the totals across the portfolio', async () => {
    const { text } = await callTool('get_portfolio');
    expect(text).toContain('Portfolio worth 115,598.00 EUR against 75,963.00 invested');
    expect(text).toContain('up 39,635.00 (+52.2%)');
  });

  it('dates the prices, since they come from a daily job', async () => {
    // Quoting a stale figure as "now" is the one way this can mislead.
    const { text } = await callTool('get_portfolio');
    expect(text).toContain('at prices from 2026-09-03');
  });

  it('leaves an unpriced position out of the totals rather than counting it as zero', async () => {
    const { text } = await callTool('get_portfolio');

    // Counting it as zero would understate the portfolio while looking like a
    // complete answer.
    expect(text).toContain('UNPRICED.XX');
    expect(text).toContain('no price recorded, so it is left out of the totals');
    // 100,836 + 14,762 — the unpriced 1,000 of cost is not in the invested figure.
    expect(text).toContain('against 75,963.00 invested');
  });

  it('names the instrument, not only its ticker', async () => {
    const { text } = await callTool('get_portfolio');
    expect(text).toContain('Vanguard FTSE All-World');
  });

  it('shows only the most recent trades, not the whole history', async () => {
    api.listTrades.mockResolvedValue(
      Array.from({ length: 40 }, (_, i) => ({
        ...fixtures.trades[0],
        _id: `6a9b1c6a5bde08b6766dfa${String(i).padStart(2, '0')}`
      })) as never
    );

    const { text } = await callTool('get_portfolio');

    expect(text.match(/\[id /g)).toHaveLength(10);
  });

  it('says so when nothing is held', async () => {
    api.listHoldings.mockResolvedValue([] as never);
    const { text } = await callTool('get_portfolio');
    expect(text).toBe('No positions are recorded.');
  });
});

describe('log_trade', () => {
  it('records a buy in the shape the endpoint validates', async () => {
    api.createTrade.mockResolvedValue({} as never);

    const { text } = await callTool('log_trade', {
      ticker: 'VWCE.DEX',
      type: 'buy',
      date: '2026-09-05',
      quantity: 10,
      price: 105.5
    });

    expect(api.createTrade).toHaveBeenCalledWith(
      KEY,
      expect.objectContaining({ ticker: 'VWCE.DEX', type: 'buy', quantity: 10, price: 105.5 }),
      undefined
    );
    expect(text).toContain('Recorded buy VWCE.DEX on 2026-09-05: 10 at 105.50');
  });

  it('records a dividend as a cash total, which takes no quantity', async () => {
    api.createTrade.mockResolvedValue({} as never);

    const { text } = await callTool('log_trade', {
      ticker: 'VWCE.DEX',
      type: 'dividend',
      date: '2026-09-05',
      amount: 42
    });

    expect(text).toContain('Recorded dividend VWCE.DEX on 2026-09-05: 42.00');
  });

  it('passes a service refusal through rather than dressing it up', async () => {
    // Which fields a type requires is enforced in the service, where the merged
    // document is visible. Restating those rules here would be a second copy to
    // keep in step.
    api.createTrade.mockRejectedValue(new TumbalandError('quantity is required for a buy', 400));

    const { isError, text } = await callTool('log_trade', {
      ticker: 'VWCE.DEX',
      type: 'buy',
      date: '2026-09-05'
    });

    expect(isError).toBe(true);
    expect(text).toBe('quantity is required for a buy');
  });
});

describe('recategorise_transactions', () => {
  it('says how many rows moved, since it cannot be undone in one step', async () => {
    api.recategorise.mockResolvedValue({ updated: 23 });

    const { text } = await callTool('recategorise_transactions', {
      fromCategory: 'Uncategorised',
      toCategory: 'Transport',
      search: 'Bolt'
    });

    expect(api.recategorise).toHaveBeenCalledWith(
      KEY,
      { fromCategory: 'Uncategorised', toCategory: 'Transport', search: 'Bolt' },
      undefined
    );
    expect(text).toBe('Moved 23 transactions from Uncategorised to Transport.');
  });

  it('gets the singular right, because a trail that reads badly gets ignored', async () => {
    api.recategorise.mockResolvedValue({ updated: 1 });

    const { text } = await callTool('recategorise_transactions', {
      fromCategory: 'A',
      toCategory: 'B'
    });

    expect(text).toBe('Moved 1 transaction from A to B.');
  });
});

describe('get_spending_trends', () => {
  it('answers the question get_spending cannot', async () => {
    // The summary covers a recent window; this covers every year on record and
    // says which categories moved, which is what "are we spending more than
    // last year" actually needs.
    api.getAnalytics.mockResolvedValue({
      years: [{ year: 2025, income: 100, expense: 80, consumption: 50, invested: 30 }],
      categories: [{ category: 'Groceries', latest: 1200, previous: 900 }]
    } as never);

    const { text } = await callTool('get_spending_trends');

    expect(api.getAnalytics).toHaveBeenCalledWith(KEY, undefined);
    expect(JSON.parse(text).categories[0].category).toBe('Groceries');
  });
});

describe('scope gating', () => {
  it('hides the writing tools from a read-only finance key', async () => {
    mockedVerify.mockResolvedValue({
      ok: true,
      userId: 'u1',
      keyId: 'k1',
      scopes: ['finance:read'],
      tenants: { allowed: ['personal'], default: 'personal' },
      tenantNames: {}
    });

    const { isError, text } = await callTool('log_trade', {
      ticker: 'X',
      type: 'buy',
      date: '2026-09-05'
    });

    expect(isError).toBe(true);
    expect(text.toLowerCase()).toContain('tool');
    expect(api.createTrade).not.toHaveBeenCalled();
  });
});
