jest.mock('../models/Transaction', () => ({ __esModule: true, default: { aggregate: jest.fn() } }));

import Transaction from '../models/Transaction';
import { getAnalytics, TRAILING_MONTHS } from './analytics.service';

const mockedAggregate = Transaction.aggregate as unknown as jest.Mock;

/** One row of the single monthly-per-category aggregation the service runs. */
const row = (
  year: number,
  month: number,
  category: string,
  type: 'income' | 'expense',
  total: number
) => ({ _id: { year, month, category, type }, total });

const withRows = (...rows: unknown[]) => mockedAggregate.mockResolvedValue(rows);

/** A full year of one category, so trailing windows have something to cover. */
const yearOf = (year: number, category: string, type: 'income' | 'expense', perMonth: number) =>
  Array.from({ length: 12 }, (_, i) => row(year, i + 1, category, type, perMonth));

beforeEach(() => jest.clearAllMocks());

describe('empty history', () => {
  it('returns empty structures rather than throwing', async () => {
    withRows();

    const analytics = await getAnalytics('u1');

    expect(analytics.years).toEqual([]);
    expect(analytics.months).toEqual([]);
    expect(analytics.categoryTrends).toEqual([]);
    expect(analytics.trailing.previous).toBeNull();
  });

  it('still reports which categories count as investing', async () => {
    withRows();

    expect((await getAnalytics('u1')).investmentCategories).toEqual(
      expect.arrayContaining(['Investments', 'Savings'])
    );
  });
});

describe('years', () => {
  it('summarises income, spending and savings', async () => {
    withRows(...yearOf(2025, 'Salary', 'income', 5000), ...yearOf(2025, 'Groceries', 'expense', 2000));

    const [year] = (await getAnalytics('u1')).years;

    expect(year).toMatchObject({ year: 2025, income: 60000, expense: 24000, consumption: 24000 });
    expect(year.savingsRate).toBeCloseTo(60, 6);
    expect(year.partial).toBe(false);
  });

  it('marks a year with fewer than twelve months as partial', async () => {
    // Two months of 2026 must not read as a collapse against a full 2025
    withRows(row(2026, 1, 'Groceries', 'expense', 100), row(2026, 2, 'Groceries', 'expense', 100));

    const [year] = (await getAnalytics('u1')).years;

    expect(year.partial).toBe(true);
    expect(year.months).toBe(2);
  });

  it('compares each year against the one before', async () => {
    withRows(
      ...yearOf(2024, 'Salary', 'income', 1000),
      ...yearOf(2025, 'Salary', 'income', 1250)
    );

    const [, latest] = (await getAnalytics('u1')).years;

    expect(latest.incomeChange).toBe(3000);
    expect(latest.incomeChangePct).toBeCloseTo(25, 6);
  });

  it('orders years oldest first', async () => {
    withRows(
      row(2026, 1, 'A', 'expense', 1),
      row(2024, 1, 'A', 'expense', 1),
      row(2025, 1, 'A', 'expense', 1)
    );

    expect((await getAnalytics('u1')).years.map((y) => y.year)).toEqual([2024, 2025, 2026]);
  });

  it('reports the savings rate as unknown for a year with no income', async () => {
    withRows(row(2025, 1, 'Groceries', 'expense', 500));

    expect((await getAnalytics('u1')).years[0].savingsRate).toBeNull();
  });
});

describe('trailing windows', () => {
  describe('the month in progress', () => {
    // Today is fixed to the 7th, so August 2026 has three weeks still to run
    beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-07T10:00:00Z')));
    afterEach(() => jest.useRealTimers());

    it('is left out of the window, however much of it has been imported', async () => {
      withRows(
        ...yearOf(2025, 'Groceries', 'expense', 100),
        ...Array.from({ length: 8 }, (_, i) => row(2026, i + 1, 'Groceries', 'expense', 100))
      );

      const { trailing } = await getAnalytics('u1');

      // Aug 2026 is the newest month with data, so without the exclusion the
      // window would end there and compare 11 whole months against 12
      expect(trailing.current.to).toBe('2026-07');
      expect(trailing.current.from).toBe('2025-08');
      expect(trailing.current.months).toBe(12);
    });

    it('keeps both windows the same length, so a comparison is like for like', async () => {
      withRows(
        ...yearOf(2024, 'Groceries', 'expense', 100),
        ...yearOf(2025, 'Groceries', 'expense', 100),
        ...Array.from({ length: 8 }, (_, i) => row(2026, i + 1, 'Groceries', 'expense', 100))
      );

      const { trailing, categoryTrends } = await getAnalytics('u1');

      expect(trailing.current.months).toBe(trailing.previous!.months);
      // 12 complete months each side at 100 a month — no phantom decline
      expect(categoryTrends[0].latest).toBe(categoryTrends[0].previous);
      expect(categoryTrends[0].change).toBe(0);
    });

    it('still keeps a thin month that is genuinely over', async () => {
      withRows(
        ...yearOf(2025, 'Groceries', 'expense', 100),
        row(2026, 7, 'Groceries', 'expense', 5)
      );

      const { trailing } = await getAnalytics('u1');

      // July is finished; 5 € is what July cost, not an artefact. The window is
      // Aug 2025 – Jul 2026: five months of 2025 at 100, then the 5 € July.
      expect(trailing.current.to).toBe('2026-07');
      expect(trailing.current.expense).toBe(505);
    });
  });

  it('covers the last twelve months of data and the twelve before', async () => {
    withRows(
      ...yearOf(2024, 'Salary', 'income', 1000),
      ...yearOf(2025, 'Salary', 'income', 2000)
    );

    const { trailing } = await getAnalytics('u1');

    expect(trailing.current).toMatchObject({ income: 24000, months: TRAILING_MONTHS, from: '2025-01', to: '2025-12' });
    expect(trailing.previous).toMatchObject({ income: 12000, from: '2024-01', to: '2024-12' });
  });

  it('anchors on the newest month with data, not on today', async () => {
    // An import that lags by months must not report an empty trailing window
    withRows(...yearOf(2020, 'Salary', 'income', 100));

    expect((await getAnalytics('u1')).trailing.current).toMatchObject({ to: '2020-12', income: 1200 });
  });

  it('has no previous window until there are two years of data', async () => {
    withRows(...yearOf(2025, 'Salary', 'income', 100));

    expect((await getAnalytics('u1')).trailing.previous).toBeNull();
  });

  it('covers fewer months when that is all there is', async () => {
    withRows(row(2026, 1, 'Salary', 'income', 100), row(2026, 2, 'Salary', 'income', 100));

    expect((await getAnalytics('u1')).trailing.current.months).toBe(2);
  });

  it('keeps investing out of consumption and out of the savings rate', async () => {
    withRows(
      ...yearOf(2025, 'Salary', 'income', 5000),
      ...yearOf(2025, 'Groceries', 'expense', 1000),
      ...yearOf(2025, 'Investments', 'expense', 3000)
    );

    const { current } = (await getAnalytics('u1')).trailing;

    expect(current.expense).toBe(48000);
    expect(current.consumption).toBe(12000);
    expect(current.invested).toBe(36000);
    expect(current.savings).toBe(48000);
    expect(current.savingsRate).toBeCloseTo(80, 6);
  });
});

describe('category trends', () => {
  it('compares the trailing window against the one before, not calendar years', async () => {
    withRows(
      ...yearOf(2024, 'Groceries', 'expense', 100),
      ...yearOf(2025, 'Groceries', 'expense', 150)
    );

    const [trend] = (await getAnalytics('u1')).categoryTrends;

    expect(trend).toMatchObject({ category: 'Groceries', latest: 1800, previous: 1200, change: 600 });
    expect(trend.changePct).toBeCloseTo(50, 6);
  });

  it('reports a per-month figure over the window, not a lifetime average', async () => {
    // Ten years of history, but the figure has to describe the recent year
    const rows = [];
    for (let y = 2016; y <= 2025; y++) rows.push(...yearOf(y, 'Groceries', 'expense', y === 2025 ? 300 : 100));
    withRows(...rows);

    const [trend] = (await getAnalytics('u1')).categoryTrends;

    expect(trend.perMonth).toBeCloseTo(300, 6);
    expect(trend.total).toBe(14400);
  });

  it('does not let a part year look like a collapse', async () => {
    // Two months into 2026 the calendar-year comparison would read −83%;
    // the trailing window sees a steady 100 a month.
    const rows = [
      ...yearOf(2024, 'Groceries', 'expense', 100),
      ...yearOf(2025, 'Groceries', 'expense', 100),
      row(2026, 1, 'Groceries', 'expense', 100),
      row(2026, 2, 'Groceries', 'expense', 100)
    ];
    withRows(...rows);

    const [trend] = (await getAnalytics('u1')).categoryTrends;

    expect(trend.latest).toBe(1200);
    expect(trend.previous).toBe(1200);
    expect(trend.changePct).toBeCloseTo(0, 6);
  });

  it('treats a category new in the window as all change', async () => {
    withRows(...yearOf(2024, 'Rent', 'expense', 10), ...yearOf(2025, 'Travel', 'expense', 25));

    const travel = (await getAnalytics('u1')).categoryTrends.find((c) => c.category === 'Travel');

    expect(travel).toMatchObject({ previous: 0, change: 300 });
    // No base to divide by, so the percentage is undefined rather than infinite
    expect(travel?.changePct).toBeNull();
  });

  it('orders by recent spend, largest first', async () => {
    withRows(
      ...yearOf(2025, 'Small', 'expense', 10),
      ...yearOf(2025, 'Big', 'expense', 500)
    );

    expect((await getAnalytics('u1')).categoryTrends.map((c) => c.category)).toEqual(['Big', 'Small']);
  });

  it('keeps income out of the spending trends', async () => {
    withRows(...yearOf(2025, 'Salary', 'income', 100), ...yearOf(2025, 'Rent', 'expense', 50));

    const analytics = await getAnalytics('u1');

    expect(analytics.categoryTrends.map((c) => c.category)).toEqual(['Rent']);
    expect(analytics.incomeSources.map((s) => s.category)).toEqual(['Salary']);
  });

  it('still carries per-year figures for the stacked chart', async () => {
    withRows(...yearOf(2024, 'Groceries', 'expense', 100), ...yearOf(2025, 'Groceries', 'expense', 200));

    expect((await getAnalytics('u1')).categoryTrends[0].byYear).toEqual({ 2024: 1200, 2025: 2400 });
  });
});

describe('income sources', () => {
  it('totals each source across years, largest first', async () => {
    withRows(
      ...yearOf(2025, 'Salary', 'income', 3000),
      ...yearOf(2025, 'Freelance', 'income', 400)
    );

    const [salary, freelance] = (await getAnalytics('u1')).incomeSources;

    expect(salary).toMatchObject({ category: 'Salary', total: 36000 });
    expect(freelance.total).toBe(4800);
  });
});

describe('month series', () => {
  it('pairs income and expense per month', async () => {
    withRows(row(2026, 3, 'Salary', 'income', 3000), row(2026, 3, 'Groceries', 'expense', 1200));

    expect((await getAnalytics('u1')).months).toEqual([
      { period: '2026-03', income: 3000, expense: 1200, consumption: 1200, invested: 0, savings: 1800 }
    ]);
  });

  it('zero-fills a month with no activity rather than leaving a gap', async () => {
    withRows(row(2026, 1, 'A', 'expense', 100), row(2026, 4, 'A', 'expense', 400));

    const months = (await getAnalytics('u1')).months;

    expect(months.map((m) => m.period)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(months[1]).toMatchObject({ income: 0, expense: 0, savings: 0 });
  });

  it('spans a year boundary', async () => {
    withRows(row(2025, 11, 'A', 'expense', 10), row(2026, 2, 'A', 'expense', 20));

    expect((await getAnalytics('u1')).months.map((m) => m.period)).toEqual([
      '2025-11', '2025-12', '2026-01', '2026-02'
    ]);
  });

  it('counts investing as kept, not spent, in the monthly savings figure', async () => {
    withRows(
      row(2026, 1, 'Salary', 'income', 3000),
      row(2026, 1, 'Investments', 'expense', 1000)
    );

    expect((await getAnalytics('u1')).months[0]).toMatchObject({ expense: 1000, savings: 3000 });
  });

  it('bounds the series so one corrupt far-future date cannot flood the chart', async () => {
    withRows(row(2020, 1, 'A', 'expense', 100), row(9999, 12, 'A', 'expense', 100));

    const months = (await getAnalytics('u1')).months;

    expect(months.length).toBeLessThanOrEqual(600);
    // Truncation keeps the recent end, which is the part anyone looks at
    expect(months[months.length - 1].period).toBe('9999-12');
  });
});

describe('scoping', () => {
  it('matches the group when one is given', async () => {
    withRows();

    await getAnalytics('u1', 'g1');

    expect(mockedAggregate.mock.calls[0][0][0]).toEqual({ $match: { groupId: { $in: ['g1'] } } });
  });

  it('matches personal documents otherwise', async () => {
    withRows();

    await getAnalytics('u1');

    expect(mockedAggregate.mock.calls[0][0][0].$match).toMatchObject({ userId: 'u1' });
  });

  it('runs a single aggregation rather than one per view', async () => {
    withRows();

    await getAnalytics('u1');

    expect(mockedAggregate).toHaveBeenCalledTimes(1);
  });
});

describe('invested and returned', () => {
  it('reports capital in gross, so a year cannot go negative', async () => {
    // Money maturing from something bought before the statements begin has no
    // matching outflow to net against; netting produced a phantom negative year
    withRows(
      ...yearOf(2025, 'Salary', 'income', 1000),
      row(2025, 3, 'Pension', 'expense', 9026),
      row(2025, 6, 'Savings', 'income', 16523)
    );

    const [year] = (await getAnalytics('u1')).years;

    expect(year.invested).toBe(9026);
    expect(year.divested).toBe(16523);
    expect(year.invested).toBeGreaterThanOrEqual(0);
  });

  it('keeps capital out of the consumption figure', async () => {
    // A year that bought 122k of ETFs must not read as 122k of spending
    withRows(
      ...yearOf(2025, 'Salary', 'income', 1000),
      ...yearOf(2025, 'Groceries', 'expense', 500),
      row(2025, 4, 'Investments', 'expense', 122425)
    );

    const [year] = (await getAnalytics('u1')).years;

    expect(year.consumption).toBe(6000);
    expect(year.expense).toBe(128425);
    expect(year.invested).toBe(122425);
  });

  it('carries consumption and invested on the month series, not just gross expense', async () => {
    // The spending chart reads consumption; plotting expense labelled it wrong
    withRows(
      row(2026, 1, 'Groceries', 'expense', 500),
      row(2026, 1, 'Investments', 'expense', 4000)
    );

    expect((await getAnalytics('u1')).months[0]).toMatchObject({
      expense: 4500,
      consumption: 500,
      invested: 4000
    });
  });
});
