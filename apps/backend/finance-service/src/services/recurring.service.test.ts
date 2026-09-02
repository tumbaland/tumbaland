jest.mock('../models/Transaction', () => ({
  __esModule: true,
  default: { find: jest.fn() }
}));

import Transaction from '../models/Transaction';
import { getRecurringPayments, merchantKey, median } from './recurring.service';

const mockedFind = Transaction.find as unknown as jest.Mock;

const NOW = new Date('2026-09-03T12:00:00.000Z');

const sorted = (rows: unknown[]) => ({ sort: jest.fn().mockResolvedValue(rows) });

const charge = (date: string, amount: number, note: string, category = 'Subscriptions') => ({
  date: new Date(`${date}T00:00:00.000Z`),
  amount,
  type: 'expense',
  category,
  note
});

/** `count` charges every `everyDays` days, ending `endsAgo` days before NOW. */
const series = (
  count: number,
  everyDays: number,
  amount: number,
  note: string,
  endsAgo = 0,
  category = 'Subscriptions'
) => {
  const end = NOW.getTime() - endsAgo * 24 * 60 * 60 * 1000;
  return Array.from({ length: count }, (_, index) => {
    const at = new Date(end - (count - 1 - index) * everyDays * 24 * 60 * 60 * 1000);
    return charge(at.toISOString().slice(0, 10), amount, note, category);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedFind.mockReturnValue(sorted([]));
});

describe('median', () => {
  it('takes the middle value of an odd-length series', () => {
    expect(median([9, 1, 5])).toBe(5);
  });

  it('averages the middle pair of an even-length series', () => {
    expect(median([1, 5, 9, 11])).toBe(7);
  });
});

describe('merchantKey', () => {
  it('groups on the counterparty, ignoring the per-charge description', () => {
    expect(merchantKey('SPOTIFY AB · invoice 88213 2026-01-04')).toBe('spotify ab');
  });

  it('folds accents and case so one merchant is one bucket', () => {
    expect(merchantKey('Café Türk · card 1234')).toBe(merchantKey('CAFE TURK · card 9999'));
  });

  it('drops reference numbers that differ on every charge', () => {
    expect(merchantKey('NETFLIX.COM 4471')).toBe('netflix com');
  });

  it('returns null for a note with nothing stable left in it', () => {
    expect(merchantKey('4471 · 2026')).toBeNull();
    expect(merchantKey(undefined)).toBeNull();
  });
});

describe('getRecurringPayments', () => {
  it('scopes the query to expenses in the window', async () => {
    await getRecurringPayments('u1', { now: NOW, months: 24 });
    expect(mockedFind).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', date: { $gte: new Date('2024-09-01T00:00:00.000Z') } })
    );
  });

  it('scopes to a group when one is given', async () => {
    await getRecurringPayments('u1', { now: NOW, groupId: 'g1' });
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ groupId: { $in: ['g1'] } }));
  });

  it('finds a monthly subscription and prices it per month and per year', async () => {
    mockedFind.mockReturnValue(sorted(series(6, 30, 11.99, 'SPOTIFY AB · monthly')));

    const report = await getRecurringPayments('u1', { now: NOW });

    expect(report.payments).toHaveLength(1);
    expect(report.payments[0]).toMatchObject({
      merchant: 'SPOTIFY AB',
      category: 'Subscriptions',
      cadence: 'monthly',
      intervalDays: 30,
      occurrences: 6,
      amount: 11.99,
      regularity: 1
    });
    expect(report.payments[0].monthlyEquivalent).toBeCloseTo(12.17, 2);
    expect(report.monthlyTotal).toBeCloseTo(12.17, 2);
    expect(report.yearlyTotal).toBeCloseTo(145.98, 2);
  });

  it('prices a yearly renewal as its monthly share, not its full amount', async () => {
    mockedFind.mockReturnValue(sorted(series(3, 365, 120, 'DOMAIN REGISTRAR · renewal')));

    const [payment] = (await getRecurringPayments('u1', { now: NOW })).payments;

    expect(payment.cadence).toBe('yearly');
    expect(payment.monthlyEquivalent).toBeCloseTo(10.01, 1);
  });

  it('ignores a merchant charged only twice — one gap is not a pattern', async () => {
    mockedFind.mockReturnValue(sorted(series(2, 30, 11.99, 'SPOTIFY AB · monthly')));
    expect((await getRecurringPayments('u1', { now: NOW })).payments).toEqual([]);
  });

  it('ignores charges spaced at nothing a billing cycle uses', async () => {
    mockedFind.mockReturnValue(sorted(series(5, 50, 30, 'CORNER SHOP · groceries', 0, 'Groceries')));
    expect((await getRecurringPayments('u1', { now: NOW })).payments).toEqual([]);
  });

  it('ignores a merchant visited at scattered intervals', async () => {
    mockedFind.mockReturnValue(
      sorted([
        charge('2026-01-02', 20, 'CORNER SHOP · x', 'Groceries'),
        charge('2026-02-01', 20, 'CORNER SHOP · x', 'Groceries'),
        charge('2026-02-04', 20, 'CORNER SHOP · x', 'Groceries'),
        charge('2026-02-06', 20, 'CORNER SHOP · x', 'Groceries'),
        charge('2026-06-01', 20, 'CORNER SHOP · x', 'Groceries')
      ])
    );
    expect((await getRecurringPayments('u1', { now: NOW })).payments).toEqual([]);
  });

  it('tolerates one late charge in an otherwise monthly series', async () => {
    mockedFind.mockReturnValue(
      sorted([
        charge('2026-03-01', 9.99, 'GYM · membership'),
        charge('2026-04-01', 9.99, 'GYM · membership'),
        charge('2026-05-01', 9.99, 'GYM · membership'),
        // Retried a fortnight late, then back on cycle.
        charge('2026-06-15', 9.99, 'GYM · membership'),
        charge('2026-07-01', 9.99, 'GYM · membership'),
        charge('2026-08-01', 9.99, 'GYM · membership'),
        charge('2026-09-01', 9.99, 'GYM · membership')
      ])
    );

    const [payment] = (await getRecurringPayments('u1', { now: NOW })).payments;

    expect(payment.cadence).toBe('monthly');
    expect(payment.regularity).toBeLessThan(1);
  });

  it('dates the next charge one interval on from the last', async () => {
    mockedFind.mockReturnValue(sorted(series(4, 30, 10, 'SPOTIFY AB · monthly', 10)));

    const [payment] = (await getRecurringPayments('u1', { now: NOW })).payments;

    expect(payment.lastCharge).toBe('2026-08-24');
    expect(payment.nextExpected).toBe('2026-09-23');
    expect(payment.daysUntilNext).toBe(20);
    expect(payment.status).toBe('active');
  });

  it('calls a charge that is late but not gone "due"', async () => {
    mockedFind.mockReturnValue(sorted(series(4, 30, 10, 'SPOTIFY AB · monthly', 40)));
    const [payment] = (await getRecurringPayments('u1', { now: NOW })).payments;
    expect(payment.status).toBe('due');
  });

  it('calls a long-silent subscription lapsed and leaves it out of the running cost', async () => {
    mockedFind.mockReturnValue(sorted(series(4, 30, 10, 'OLD SERVICE · monthly', 200)));

    const report = await getRecurringPayments('u1', { now: NOW });

    expect(report.payments[0].status).toBe('lapsed');
    expect(report.lapsedCount).toBe(1);
    // Still listed — knowing it stopped is the point — but not billed for.
    expect(report.monthlyTotal).toBe(0);
  });

  it('reports a price rise against what the charge used to be', async () => {
    mockedFind.mockReturnValue(
      sorted([
        charge('2026-05-01', 9.99, 'SPOTIFY AB · monthly'),
        charge('2026-06-01', 9.99, 'SPOTIFY AB · monthly'),
        charge('2026-07-01', 9.99, 'SPOTIFY AB · monthly'),
        charge('2026-08-01', 11.99, 'SPOTIFY AB · monthly')
      ])
    );

    const [payment] = (await getRecurringPayments('u1', { now: NOW })).payments;

    expect(payment.priceChange).toEqual({
      previousAmount: 9.99,
      currentAmount: 11.99,
      changedOn: '2026-08-01'
    });
  });

  it('does not call a rounding-sized difference a price change', async () => {
    mockedFind.mockReturnValue(
      sorted([
        charge('2026-06-01', 10, 'ENERGY CO · bill', 'Utilities'),
        charge('2026-07-01', 10, 'ENERGY CO · bill', 'Utilities'),
        charge('2026-08-01', 10.2, 'ENERGY CO · bill', 'Utilities')
      ])
    );

    const [payment] = (await getRecurringPayments('u1', { now: NOW })).payments;

    expect(payment.priceChange).toBeNull();
  });

  it('reports how much a variable bill moves around', async () => {
    mockedFind.mockReturnValue(
      sorted([
        charge('2026-06-01', 40, 'ENERGY CO · bill', 'Utilities'),
        charge('2026-07-01', 60, 'ENERGY CO · bill', 'Utilities'),
        charge('2026-08-01', 50, 'ENERGY CO · bill', 'Utilities')
      ])
    );

    const [payment] = (await getRecurringPayments('u1', { now: NOW })).payments;

    expect(payment.amount).toBe(50);
    expect(payment.amountVariation).toBeCloseTo(0.4, 2);
  });

  it('lists the most expensive subscription per month first', async () => {
    mockedFind.mockReturnValue(
      sorted([
        ...series(4, 30, 5, 'CHEAP CO · monthly'),
        ...series(4, 30, 50, 'PRICEY CO · monthly')
      ])
    );

    const report = await getRecurringPayments('u1', { now: NOW });

    expect(report.payments.map((payment) => payment.merchant)).toEqual(['PRICEY CO', 'CHEAP CO']);
  });

  it('skips rows with no usable merchant rather than grouping them together', async () => {
    mockedFind.mockReturnValue(
      sorted([
        charge('2026-06-01', 10, '4471'),
        charge('2026-07-01', 10, '4471'),
        charge('2026-08-01', 10, '4471')
      ])
    );
    expect((await getRecurringPayments('u1', { now: NOW })).payments).toEqual([]);
  });
});
