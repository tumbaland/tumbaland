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

/**
 * The JSON out of one SSE frame.
 *
 * Split on the *first* delimiter rather than every one: a tool result is free
 * to contain the string "data: " — one of them does — and splitting on all of
 * them truncates the payload mid-string, which surfaces as a JSON parse error
 * about the transport and says nothing about the tool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sseBody = (text: string): any => {
  const at = text.indexOf('data: ');
  return JSON.parse(at === -1 ? '{}' : text.slice(at + 'data: '.length));
};

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

  const payload = sseBody(res.text);
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
      'personal'
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
      'personal'
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

/**
 * The four aggregate tools, which used to hand the model raw JSON.
 *
 * Between them they cost about twenty-two thousand tokens a conversation, and
 * a tool result is resent with every later turn, so the bill was that figure
 * multiplied by the length of the conversation. Each of these now reads the
 * endpoint and renders the part worth reading, and each test says both things:
 * the numbers survived, and the answer stayed small.
 */
describe('get_net_worth', () => {
  beforeEach(() => api.getDashboard.mockResolvedValue(fixtures.dashboard as never));

  it('reads the journal it was asked for, even when the connection defaults to a shared one', async () => {
    mockedVerify.mockResolvedValue({
      ok: true,
      userId: 'u1',
      keyId: 'k1',
      scopes: ['finance:read'],
      tenants: { allowed: ['personal', 'g1'], default: 'g1' },
      tenantNames: { personal: 'My own data', g1: 'Irja & Tom' }
    });

    await callTool('get_net_worth', { journal: 'My own data' });
    await callTool('get_net_worth', { journal: 'Irja & Tom' });

    // An absent group would read as the default, the shared journal, for both.
    expect(api.getDashboard).toHaveBeenNthCalledWith(1, KEY, 'personal');
    expect(api.getDashboard).toHaveBeenNthCalledWith(2, KEY, 'g1');
  });

  it('leads with what it is worth, and when that was true', async () => {
    const { text } = await callTool('get_net_worth');

    expect(text).toContain('Net worth 510,116 EUR as at 2026-09-01');
    // Prices come from a daily job. A figure quoted as "now" that is a week old
    // is the one way this tool can mislead without being wrong.
    expect(text).toContain('510,116 in assets, nothing owed');
  });

  it('says how it moved over the month, the year and all of it', async () => {
    const { text } = await callTool('get_net_worth');

    expect(text).toContain('Over the month: up 17,440 (+3.5%)');
    expect(text).toContain('Over the year: up 101,650 (+24.9%)');
    expect(text).toContain('Since the start: up 121,405 (+31.2%)');
  });

  it('breaks the total down by asset class', async () => {
    const { text } = await callTool('get_net_worth');

    expect(text).toContain('- Investments 253,047 (50%), gain 90,018');
    expect(text).toContain('- Real estate 150,000');
  });

  it('keeps money consumed apart from money moved into an asset', async () => {
    const { text } = await callTool('get_net_worth');

    // Spending 65,688 of which 39,021 went into investments is not the same
    // story as spending 65,688, and only one of them is true.
    expect(text).toContain('26,668 consumed, 39,021 into assets');
    expect(text).toContain('The 12 before');
  });

  it('says why net worth moved, not only that it did', async () => {
    const { text } = await callTool('get_net_worth');

    expect(text).toContain('18,052 from the market');
    expect(text).toContain('-612 from contributions');
  });

  it('sends year ends rather than the daily series behind them', async () => {
    const { text } = await callTool('get_net_worth');

    expect(text).toContain('Net worth at each year end:');
    expect(text).toContain('2016 302');
    // The endpoint carries one point per day for ever. The app's chart needs
    // every one; a question about the trajectory needs about ten.
    expect(text).not.toContain('2026-09-01T00:00:00.000Z');
  });

  it('leaves out a growth split that does not add up', async () => {
    api.getDashboard.mockResolvedValue({
      ...fixtures.dashboard,
      cashflow: {
        ...fixtures.dashboard.cashflow,
        growth: { ...fixtures.dashboard.cashflow.growth, complete: false }
      }
    } as never);

    const { text } = await callTool('get_net_worth');

    // Two figures that disagree with their own total is worse than neither: a
    // model handed them will reconcile the gap by inventing a reason for it.
    expect(text).not.toContain('from the market');
  });

  it('stays small enough to carry through a conversation', async () => {
    const { text } = await callTool('get_net_worth');
    expect(text.length).toBeLessThan(2000);
  });
});

describe('get_spending', () => {
  beforeEach(() => api.getSummary.mockResolvedValue(fixtures.summary as never));

  it('gives the month-by-month figures this tool exists for', async () => {
    const { text } = await callTool('get_spending', { months: 12 });

    expect(text).toContain('Month by month:');
    expect(text).toContain('- 2025-10: in 4,994, out 1,606, saved 3,388 (68%)');
    expect(api.getSummary).toHaveBeenCalledWith(KEY, 12, 'personal');
  });

  it('says the category figures are per month, since they are an average', async () => {
    const { text } = await callTool('get_spending');

    // Read as a total, this is out by the length of the window, and nothing in
    // the number itself says which it is.
    expect(text).toContain('Spending by category, per month on average:');
    expect(text).toContain('- Investments 2,195');
  });

  it('carries the totals across the whole window', async () => {
    const { text } = await callTool('get_spending');

    expect(text).toContain('Across the window: income 58,088');
  });

  it('says so when the window holds nothing', async () => {
    api.getSummary.mockResolvedValue({ months: [], categories: [] } as never);

    const { text } = await callTool('get_spending');

    expect(text).toBe('Nothing is recorded for that window.');
  });
});

describe('get_spending_trends', () => {
  beforeEach(() => api.getAnalytics.mockResolvedValue(fixtures.analytics as never));

  it('answers the question get_spending cannot', async () => {
    // The summary covers a recent window; this covers every year on record and
    // says which categories moved, which is what "are we spending more than
    // last year" actually needs.
    const { text } = await callTool('get_spending_trends');

    expect(api.getAnalytics).toHaveBeenCalledWith(KEY, 'personal');
    expect(text).toContain('Income and spending by year (EUR):');
    expect(text).toContain('- 2025: in 63,001, out 64,735');
  });

  it('marks a year with less than twelve months behind it', async () => {
    const { text } = await callTool('get_spending_trends');

    // Its totals are smaller than a full year's for a reason that is not a
    // trend. "Months of data", not "months so far": the flag is true of the
    // year in progress and just as true of a sparse year a decade ago.
    expect(text).toContain('- 2026 (9 months of data):');
  });

  it('names which categories moved and by how much', async () => {
    const { text } = await callTool('get_spending_trends');

    expect(text).toContain('- Home 7,628, up 7,087');
    expect(text).toContain('- Travel 2,296, down 1,353 (-37.1%)');
  });

  it('gives one recent figure per income source, not the whole per-year map', async () => {
    const { text } = await callTool('get_spending_trends');

    // A source that stopped in 2021 is a different answer from one still
    // paying, and one figure says which without carrying eight.
    expect(text).toContain('- Salary 303,043, 41,298 in 2026');
    expect(text).not.toContain('"2019"');
  });

  it('points at get_spending rather than carrying every month itself', async () => {
    const { text } = await callTool('get_spending_trends');

    expect(text).toContain('For month-by-month figures, call get_spending.');
    // The endpoint carries one point per month since the first transaction.
    expect(text).not.toContain('"period"');
  });

  it('stays small enough to carry through a conversation', async () => {
    const { text } = await callTool('get_spending_trends');
    expect(text.length).toBeLessThan(3000);
  });
});

describe('list_recurring_payments', () => {
  beforeEach(() => api.getRecurring.mockResolvedValue(fixtures.recurring as never));

  it('leads with what the subscriptions cost in total', async () => {
    const { text } = await callTool('list_recurring_payments', { months: 12 });

    expect(text).toContain('877 a month, 10,519 a year');
    expect(text).toContain('have stopped arriving');
    expect(api.getRecurring).toHaveBeenCalledWith(KEY, 12, 'personal');
  });

  it('names each payment with its charge, cadence and state', async () => {
    const { text } = await callTool('list_recurring_payments');

    expect(text).toContain('- ACME PENSION FUND (Pension): 607.00 monthly');
    expect(text).toContain('due');
  });

  it('says how overdue a payment is, rather than only when it was expected', async () => {
    const { text } = await callTool('list_recurring_payments');

    expect(text).toContain('23 days overdue');
  });

  it('says so when nothing repeats often enough to count', async () => {
    api.getRecurring.mockResolvedValue({
      monthlyTotal: 0,
      yearlyTotal: 0,
      payments: []
    } as never);

    const { text } = await callTool('list_recurring_payments');

    expect(text).toContain('Nothing in that window repeats often enough');
  });
});

/**
 * The same four tools against a response with every optional field missing.
 *
 * Each of these renderers is a chain of "include this clause if the field is
 * there", and the failure mode when one is wrong is not a crash — it is the
 * word "undefined" or "NaN" in a sentence the model then quotes back to
 * somebody about their money. The endpoints genuinely do omit these: a fresh
 * account has no previous period to compare against, an unpriced asset class no
 * gain, a first-year subscription no price change.
 */
describe('the aggregate tools against a sparse response', () => {
  const clean = (text: string) => {
    expect(text).not.toMatch(/undefined|NaN|null/);
    return text;
  };

  it('reports a net worth with no history, no comparison and no positions', async () => {
    api.getDashboard.mockResolvedValue({
      kpis: { netWorth: 1000, assets: 1000, liabilities: 250 },
      netWorthHistory: [],
      allocation: [{ name: 'Cash', value: 1000 }],
      liabilities: [{ name: 'Mortgage', value: 250 }]
    } as never);

    const { text } = await callTool('get_net_worth');

    expect(clean(text)).toContain('Net worth 1,000: 1,000 in assets, 250 owed.');
    expect(text).toContain('- Cash 1,000');
    expect(text).toContain('Owed:');
    expect(text).toContain('- Mortgage 250');
    // One year of history is not a series worth naming.
    expect(text).not.toContain('year end');
  });

  it('names the positions left out of the totals for want of a rate', async () => {
    api.getDashboard.mockResolvedValue({
      kpis: { netWorth: 1000, assets: 1000, liabilities: 0 },
      netWorthHistory: [],
      allocation: [],
      liabilities: [],
      holdings: { count: 2, totalValue: 900, totalCost: 800, gain: 100, gainPct: 12.5, unconverted: 1 }
    } as never);

    const { text } = await callTool('get_net_worth');

    // Counted as zero it would understate the portfolio while looking complete.
    expect(clean(text)).toContain('1 left out of the totals for want of an exchange rate');
  });

  it('reports a trend with no year-on-year comparison to make', async () => {
    api.getAnalytics.mockResolvedValue({
      years: [{ year: 2026, income: 10, expense: 4, consumption: 4, invested: 0, savings: 6, partial: true }],
      categoryTrends: [{ category: 'Groceries', latest: 400 }],
      incomeSources: [{ category: 'Salary', total: 10 }],
      investmentCategories: []
    } as never);

    const { text } = await callTool('get_spending_trends');

    expect(clean(text)).toContain('- 2026 (0 months of data): in 10, out 4');
    expect(text).toContain('- Groceries 400');
    expect(text).toContain('- Salary 10');
    expect(text).not.toContain('against the year before');
  });

  it('reports a subscription with no cadence, no history and no price change', async () => {
    api.getRecurring.mockResolvedValue({
      monthlyTotal: 10,
      yearlyTotal: 120,
      payments: [{ merchant: 'ACME', amount: 10 }]
    } as never);

    const { text } = await callTool('list_recurring_payments');

    expect(clean(text)).toContain('- ACME: 10.00');
    expect(text).toContain('1 recurring payments');
  });

  it('gets the singular right on a payment that is one day late', async () => {
    api.getRecurring.mockResolvedValue({
      monthlyTotal: 10,
      yearlyTotal: 120,
      payments: [{ merchant: 'ACME', amount: 10, daysUntilNext: -1 }]
    } as never);

    const { text } = await callTool('list_recurring_payments');

    expect(text).toContain('1 day overdue');
  });

  it('reports a month with no income, where a savings rate cannot be taken', async () => {
    api.getSummary.mockResolvedValue({
      months: [{ month: '2026-09', income: 0, expense: 17, savings: -17, savingsRate: null }],
      categories: [],
      totals: { income: 0, expense: 17, savings: -17, savingsRate: null }
    } as never);

    const { text } = await callTool('get_spending');

    expect(clean(text)).toContain('- 2026-09: in 0, out 17, saved -17');
    expect(text).toContain('Across the window: income 0, out 17, saved -17.');
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
