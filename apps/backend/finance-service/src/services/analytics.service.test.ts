jest.mock('../models/Transaction', () => ({ __esModule: true, default: { aggregate: jest.fn() } }));

import Transaction from '../models/Transaction';
import { getAnalytics } from './analytics.service';

const mockedAggregate = Transaction.aggregate as unknown as jest.Mock;

/**
 * The service fires four aggregations in parallel; this feeds each in order:
 * per year+type totals, per year+category+type totals, months-with-data, and
 * per month+type totals.
 */
const withAggregates = (
  yearType: unknown[],
  categoryYear: unknown[],
  months: unknown[],
  monthType: unknown[] = []
) => {
  mockedAggregate
    .mockResolvedValueOnce(yearType)
    .mockResolvedValueOnce(categoryYear)
    .mockResolvedValueOnce(months)
    .mockResolvedValueOnce(monthType);
};

const yt = (year: number, type: string, total: number) => ({ _id: { year, type }, total });
const cy = (year: number, category: string, type: string, total: number) => ({
  _id: { year, category, type },
  total
});

beforeEach(() => jest.clearAllMocks());

describe('years', () => {
  it('is empty with no transactions', async () => {
    withAggregates([], [], []);

    const analytics = await getAnalytics('u1');

    expect(analytics.years).toEqual([]);
    expect(analytics.categoryTrends).toEqual([]);
  });

  it('summarises income, expense and savings per year', async () => {
    withAggregates([yt(2025, 'income', 50000), yt(2025, 'expense', 20000)], [], [{ _id: 2025, months: 12 }]);

    const [year] = (await getAnalytics('u1')).years;

    expect(year).toMatchObject({ year: 2025, income: 50000, expense: 20000, savings: 30000 });
    expect(year.savingsRate).toBeCloseTo(60, 6);
  });

  it('leaves the first year on record without a comparison', async () => {
    withAggregates([yt(2025, 'income', 100)], [], []);

    const [year] = (await getAnalytics('u1')).years;

    expect(year.incomeChange).toBeNull();
    expect(year.expenseChangePct).toBeNull();
  });

  it('compares each year against the one before', async () => {
    withAggregates(
      [
        yt(2024, 'income', 40000), yt(2024, 'expense', 20000),
        yt(2025, 'income', 50000), yt(2025, 'expense', 15000)
      ],
      [],
      []
    );

    const [, latest] = (await getAnalytics('u1')).years;

    expect(latest.incomeChange).toBe(10000);
    expect(latest.incomeChangePct).toBeCloseTo(25, 6);
    expect(latest.expenseChange).toBe(-5000);
    expect(latest.expenseChangePct).toBeCloseTo(-25, 6);
  });

  it('orders years oldest first', async () => {
    withAggregates([yt(2026, 'income', 1), yt(2024, 'income', 1), yt(2025, 'income', 1)], [], []);

    expect((await getAnalytics('u1')).years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
  });

  it('reports the savings rate as unknown for a year with no income', async () => {
    withAggregates([yt(2025, 'expense', 500)], [], []);

    expect((await getAnalytics('u1')).years[0].savingsRate).toBeNull();
  });
});

describe('category trends', () => {
  it('tracks spend per year and the change into the latest one', async () => {
    withAggregates(
      [yt(2024, 'expense', 1000), yt(2025, 'expense', 1500)],
      [cy(2024, 'Groceries', 'expense', 1000), cy(2025, 'Groceries', 'expense', 1500)],
      []
    );

    const [trend] = (await getAnalytics('u1')).categoryTrends;

    expect(trend).toMatchObject({ category: 'Groceries', latest: 1500, previous: 1000, change: 500 });
    expect(trend.changePct).toBeCloseTo(50, 6);
    expect(trend.byYear).toEqual({ 2024: 1000, 2025: 1500 });
  });

  it('treats a category new in the latest year as all change', async () => {
    withAggregates(
      [yt(2024, 'expense', 10), yt(2025, 'expense', 300)],
      [cy(2024, 'Rent', 'expense', 10), cy(2025, 'Travel', 'expense', 300)],
      []
    );

    const travel = (await getAnalytics('u1')).categoryTrends.find((c) => c.category === 'Travel');

    expect(travel).toMatchObject({ previous: 0, change: 300 });
    // No base to divide by, so the percentage is undefined rather than infinite
    expect(travel?.changePct).toBeNull();
  });

  it('orders by lifetime total, largest first', async () => {
    withAggregates(
      [yt(2025, 'expense', 1300)],
      [cy(2025, 'Small', 'expense', 300), cy(2025, 'Big', 'expense', 1000)],
      []
    );

    expect((await getAnalytics('u1')).categoryTrends.map((c) => c.category)).toEqual(['Big', 'Small']);
  });

  it('keeps income out of the spending trends', async () => {
    withAggregates(
      [yt(2025, 'income', 5000), yt(2025, 'expense', 100)],
      [cy(2025, 'Salary', 'income', 5000), cy(2025, 'Rent', 'expense', 100)],
      []
    );

    const analytics = await getAnalytics('u1');

    expect(analytics.categoryTrends.map((c) => c.category)).toEqual(['Rent']);
    expect(analytics.incomeSources.map((s) => s.category)).toEqual(['Salary']);
  });
});

describe('income sources', () => {
  it('totals each source across years, largest first', async () => {
    withAggregates(
      [yt(2024, 'income', 1), yt(2025, 'income', 1)],
      [
        cy(2024, 'Salary', 'income', 30000),
        cy(2025, 'Salary', 'income', 35000),
        cy(2025, 'Freelance', 'income', 5000)
      ],
      []
    );

    const [salary, freelance] = (await getAnalytics('u1')).incomeSources;

    expect(salary).toMatchObject({ category: 'Salary', total: 65000 });
    expect(salary.byYear).toEqual({ 2024: 30000, 2025: 35000 });
    expect(freelance.total).toBe(5000);
  });
});

describe('monthly averages', () => {
  it('divides by the months that actually have data', async () => {
    // A part year: 3 months of data must not be averaged over twelve
    withAggregates([yt(2026, 'expense', 3000)], [], [{ _id: 2026, months: 3 }]);

    expect((await getAnalytics('u1')).monthlyAverages[0]).toMatchObject({
      year: 2026,
      expense: 1000,
      months: 3
    });
  });

  it('assumes a full year when the month count is missing', async () => {
    withAggregates([yt(2025, 'expense', 1200)], [], []);

    expect((await getAnalytics('u1')).monthlyAverages[0].expense).toBe(100);
  });
});

describe('scoping', () => {
  it('matches the group when one is given', async () => {
    withAggregates([], [], []);

    await getAnalytics('u1', 'g1');

    expect(mockedAggregate.mock.calls[0][0][0]).toEqual({ $match: { groupId: { $in: ['g1'] } } });
  });

  it('matches personal documents otherwise', async () => {
    withAggregates([], [], []);

    await getAnalytics('u1');

    expect(mockedAggregate.mock.calls[0][0][0].$match).toMatchObject({ userId: 'u1' });
  });
});

describe('month series', () => {
  const withMonths = (monthRows: unknown[]) => {
    mockedAggregate
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(monthRows);
  };
  const mt = (year: number, month: number, type: string, total: number) => ({
    _id: { year, month, type },
    total
  });

  it('is empty with no transactions', async () => {
    withMonths([]);
    expect((await getAnalytics('u1')).months).toEqual([]);
  });

  it('pairs income and expense per month', async () => {
    withMonths([mt(2026, 3, 'income', 3000), mt(2026, 3, 'expense', 1200)]);

    expect((await getAnalytics('u1')).months).toEqual([
      { period: '2026-03', income: 3000, expense: 1200, savings: 1800 }
    ]);
  });

  it('zero-fills a month with no activity rather than leaving a gap', async () => {
    withMonths([mt(2026, 1, 'expense', 100), mt(2026, 4, 'expense', 400)]);

    const months = (await getAnalytics('u1')).months;

    expect(months.map((m) => m.period)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(months[1]).toMatchObject({ income: 0, expense: 0, savings: 0 });
  });

  it('spans a year boundary', async () => {
    withMonths([mt(2025, 11, 'expense', 10), mt(2026, 2, 'expense', 20)]);

    expect((await getAnalytics('u1')).months.map((m) => m.period)).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02'
    ]);
  });

  it('bounds the series so one corrupt far-future date cannot flood the chart', async () => {
    // A mistyped year would otherwise zero-fill ~96 000 months
    withMonths([mt(2020, 1, 'expense', 100), mt(9999, 12, 'expense', 100)]);

    const months = (await getAnalytics('u1')).months;

    expect(months.length).toBeLessThanOrEqual(600);
    expect(months[0].period).toBe('2020-01');
  });
});

describe('investing versus consumption', () => {
  it('keeps money moved into an asset out of the savings-rate calculation', async () => {
    // 5000 in, 1000 consumed, 3000 into a broker: kept 4000, not 1000
    withAggregates(
      [yt(2025, 'income', 5000), yt(2025, 'expense', 4000)],
      [cy(2025, 'Groceries', 'expense', 1000), cy(2025, 'Investments', 'expense', 3000)],
      []
    );

    const [year] = (await getAnalytics('u1')).years;

    expect(year.expense).toBe(4000);
    expect(year.consumption).toBe(1000);
    expect(year.invested).toBe(3000);
    expect(year.savings).toBe(4000);
    expect(year.savingsRate).toBeCloseTo(80, 6);
  });

  it('counts a savings deposit the same way', async () => {
    withAggregates(
      [yt(2025, 'income', 1000), yt(2025, 'expense', 500)],
      [cy(2025, 'Savings', 'expense', 500)],
      []
    );

    expect((await getAnalytics('u1')).years[0]).toMatchObject({ consumption: 0, invested: 500, savings: 1000 });
  });

  it('leaves a year with no investing unchanged', async () => {
    withAggregates(
      [yt(2025, 'income', 1000), yt(2025, 'expense', 400)],
      [cy(2025, 'Groceries', 'expense', 400)],
      []
    );

    expect((await getAnalytics('u1')).years[0]).toMatchObject({ consumption: 400, invested: 0, savings: 600 });
  });

  it('publishes which categories count as investing', async () => {
    withAggregates([], [], []);

    expect((await getAnalytics('u1')).investmentCategories).toEqual(
      expect.arrayContaining(['Investments', 'Savings'])
    );
  });
});
