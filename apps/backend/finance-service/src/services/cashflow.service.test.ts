jest.mock('../models/Transaction', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('../models/Budget', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('../models/Snapshot', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('../models/AssetClass', () => ({ __esModule: true, default: { find: jest.fn() } }));

import Transaction from '../models/Transaction';
import Budget from '../models/Budget';
import Snapshot from '../models/Snapshot';
import AssetClass from '../models/AssetClass';
import { getCashflowSummary } from './cashflow.service';

const mockedTransactionFind = Transaction.find as unknown as jest.Mock;
const mockedBudgetFind = Budget.find as unknown as jest.Mock;
const mockedSnapshotFind = Snapshot.find as unknown as jest.Mock;
const mockedAssetClassFind = AssetClass.find as unknown as jest.Mock;

const sorted = (rows: unknown[]) => ({ sort: jest.fn().mockResolvedValue(rows) });
/** Snapshot.find(...).sort(...).limit(...) */
const sortedLimited = (rows: unknown[]) => ({
  sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(rows) })
});

const income = (date: string, amount: number, category = 'Salary') => ({
  date: new Date(date),
  amount,
  type: 'income',
  category
});

const expense = (date: string, amount: number, category = 'Groceries') => ({
  date: new Date(date),
  amount,
  type: 'expense',
  category
});

/** A month key inside the default 12-month window, so tests are not time-bombed. */
const thisMonth = () => new Date().toISOString().slice(0, 7);
const dayIn = (month: string) => `${month}-05T00:00:00.000Z`;

beforeEach(() => {
  jest.clearAllMocks();
  mockedTransactionFind.mockReturnValue(sorted([]));
  mockedBudgetFind.mockResolvedValue([]);
  mockedSnapshotFind.mockReturnValue(sortedLimited([]));
  mockedAssetClassFind.mockResolvedValue([]);
});

describe('getCashflowSummary', () => {
  it('is empty when there are no transactions', async () => {
    const summary = await getCashflowSummary('u1');

    expect(summary.months).toEqual([]);
    expect(summary.categories).toEqual([]);
    expect(summary.totals).toMatchObject({ income: 0, expense: 0, savings: 0, savingsRate: null });
  });

  it('groups income and expense by month', async () => {
    const month = thisMonth();
    mockedTransactionFind.mockReturnValue(
      sorted([income(dayIn(month), 3000), expense(dayIn(month), 1200), expense(dayIn(month), 300, 'Rent')])
    );

    const summary = await getCashflowSummary('u1');

    expect(summary.months).toHaveLength(1);
    expect(summary.months[0]).toMatchObject({ month, income: 3000, expense: 1500, savings: 1500 });
    expect(summary.months[0].savingsRate).toBeCloseTo(50, 6);
  });

  it('reports the savings rate as unknown when nothing came in', async () => {
    mockedTransactionFind.mockReturnValue(sorted([expense(dayIn(thisMonth()), 400)]));

    const summary = await getCashflowSummary('u1');

    expect(summary.months[0].savingsRate).toBeNull();
    expect(summary.months[0].savings).toBe(-400);
  });

  it('breaks spending down by category, ignoring income categories', async () => {
    const month = thisMonth();
    mockedTransactionFind.mockReturnValue(
      sorted([income(dayIn(month), 3000), expense(dayIn(month), 900, 'Rent'), expense(dayIn(month), 200, 'Groceries')])
    );

    const summary = await getCashflowSummary('u1');

    expect(summary.categories.map((c) => c.category)).toEqual(['Rent', 'Groceries']);
    expect(summary.categories[0].spent).toBe(900);
  });

  it('compares the monthly average against the budget', async () => {
    mockedTransactionFind.mockReturnValue(sorted([expense(dayIn(thisMonth()), 900, 'Rent')]));
    mockedBudgetFind.mockResolvedValue([{ category: 'Rent', amount: 800 }]);

    const summary = await getCashflowSummary('u1');

    expect(summary.categories[0]).toMatchObject({ spent: 900, budget: 800, variance: 100 });
  });

  it('averages spend over the months that have data, not the whole window', async () => {
    // Two months of transactions, 900 spent in total → an average of 450
    const now = new Date();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 5)).toISOString();
    mockedTransactionFind.mockReturnValue(
      sorted([expense(dayIn(thisMonth()), 600, 'Rent'), expense(previous, 300, 'Rent')])
    );

    const summary = await getCashflowSummary('u1');

    expect(summary.months).toHaveLength(2);
    expect(summary.categories[0].spent).toBe(450);
  });

  it('lists a budgeted category that has no spend yet', async () => {
    mockedTransactionFind.mockReturnValue(sorted([expense(dayIn(thisMonth()), 100, 'Rent')]));
    mockedBudgetFind.mockResolvedValue([{ category: 'Travel', amount: 200 }]);

    const summary = await getCashflowSummary('u1');

    expect(summary.categories.find((c) => c.category === 'Travel')).toMatchObject({
      spent: 0,
      budget: 200,
      variance: -200
    });
  });

  it('leaves the variance unknown for a category with no budget', async () => {
    mockedTransactionFind.mockReturnValue(sorted([expense(dayIn(thisMonth()), 100, 'Rent')]));

    const summary = await getCashflowSummary('u1');

    expect(summary.categories[0]).toMatchObject({ budget: null, variance: null });
  });

  it('scopes to the group when one is given', async () => {
    await getCashflowSummary('u1', { groupId: 'g1' });

    expect(mockedBudgetFind).toHaveBeenCalledWith({ groupId: { $in: ['g1'] } });
  });
});

describe('growth breakdown', () => {
  const snapshotsAt = (previousMonth: string, latestMonth: string, previousNet: number, latestNet: number) =>
    sortedLimited([
      { date: new Date(`${latestMonth}-01T00:00:00.000Z`), entries: [{ assetClassId: 'a1', value: latestNet, gain: 0 }] },
      { date: new Date(`${previousMonth}-01T00:00:00.000Z`), entries: [{ assetClassId: 'a1', value: previousNet, gain: 0 }] }
    ]);

  it('is null with fewer than two check-ins to compare', async () => {
    mockedSnapshotFind.mockReturnValue(sortedLimited([{ date: new Date(), entries: [] }]));

    expect((await getCashflowSummary('u1')).growth).toBeNull();
  });

  it('splits the change into what was saved and what the market did', async () => {
    const now = new Date();
    const latest = thisMonth();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7);

    // 1500 saved in the month that moved net worth by 2000
    mockedTransactionFind.mockReturnValue(
      sorted([income(dayIn(previous), 3000), expense(dayIn(previous), 1500)])
    );
    mockedSnapshotFind.mockReturnValue(snapshotsAt(previous, latest, 10_000, 12_000));

    const { growth } = await getCashflowSummary('u1');

    expect(growth).toMatchObject({
      netWorthChange: 2000,
      contributions: 1500,
      marketGrowth: 500,
      complete: true
    });
  });

  it('flags the split as incomplete when the period has no transactions', async () => {
    const now = new Date();
    const latest = thisMonth();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7);

    mockedSnapshotFind.mockReturnValue(snapshotsAt(previous, latest, 10_000, 12_000));

    const { growth } = await getCashflowSummary('u1');

    expect(growth).toMatchObject({ netWorthChange: 2000, contributions: 0, complete: false });
  });

  it('nets liabilities out of both ends of the comparison', async () => {
    const now = new Date();
    const latest = thisMonth();
    const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7);

    mockedAssetClassFind.mockResolvedValue([{ _id: 'debt', name: 'Mortgage', kind: 'liability' }]);
    mockedSnapshotFind.mockReturnValue(
      sortedLimited([
        {
          date: new Date(`${latest}-01T00:00:00.000Z`),
          entries: [
            { assetClassId: 'a1', value: 12_000, gain: 0 },
            { assetClassId: 'debt', value: 1000, gain: 0 }
          ]
        },
        {
          date: new Date(`${previous}-01T00:00:00.000Z`),
          entries: [
            { assetClassId: 'a1', value: 10_000, gain: 0 },
            { assetClassId: 'debt', value: 2000, gain: 0 }
          ]
        }
      ])
    );

    const { growth } = await getCashflowSummary('u1');

    // (12000 − 1000) − (10000 − 2000)
    expect(growth?.netWorthChange).toBe(3000);
  });
});
