jest.mock('../models/Snapshot', () => ({
  __esModule: true,
  default: { find: jest.fn() }
}));

jest.mock('../models/AssetClass', () => ({
  __esModule: true,
  default: { find: jest.fn() }
}));

jest.mock('./holding.service', () => ({
  getAllHoldings: jest.fn()
}));

jest.mock('./fxRate.service', () => ({
  BASE_CURRENCY: 'EUR'
}));

jest.mock('./closedPosition.service', () => ({ getClosedPositions: jest.fn() }));
jest.mock('./cashflow.service', () => ({ getCashflowSummary: jest.fn() }));
jest.mock('./analytics.service', () => ({ getAnalytics: jest.fn() }));

import Snapshot from '../models/Snapshot';
import AssetClass from '../models/AssetClass';
import { getAllHoldings } from './holding.service';
import { getClosedPositions } from './closedPosition.service';
import { getCashflowSummary } from './cashflow.service';
import { getAnalytics } from './analytics.service';
import { getDashboardData } from './dashboard.service';

const mockedSnapshotFind = Snapshot.find as unknown as jest.Mock;
const mockedAssetClassFind = AssetClass.find as unknown as jest.Mock;
const mockedGetAllHoldings = getAllHoldings as unknown as jest.Mock;
const mockedClosed = getClosedPositions as unknown as jest.Mock;
const mockedCashflow = getCashflowSummary as unknown as jest.Mock;
const mockedAnalytics = getAnalytics as unknown as jest.Mock;

// Snapshot.find(...).sort({ date: 1 }) — the service awaits the .sort() result.
const mockSnapshots = (snapshots: unknown[]) => {
  mockedSnapshotFind.mockReturnValue({ sort: jest.fn().mockResolvedValue(snapshots) });
};

const snap = (date: string, entries: Array<{ assetClassId: string; value: number; gain: number }>) => ({
  date: new Date(date),
  entries
});

const assetClasses = [
  { _id: 'ac1', name: 'Stocks', color: '#111', kind: 'asset' },
  { _id: 'ac2', name: 'Cash', color: '#222', kind: 'asset' },
  { _id: 'ac3', name: 'Mortgage', color: '#333', kind: 'liability' }
];

describe('getDashboardData', () => {
  beforeEach(() => {
    mockedAssetClassFind.mockResolvedValue(assetClasses);
    mockedGetAllHoldings.mockResolvedValue([]);
    mockedClosed.mockResolvedValue([]);
    mockedCashflow.mockResolvedValue({ months: [], categories: [], totals: {}, growth: null });
    mockedAnalytics.mockResolvedValue({ months: [], trailing: { current: {}, previous: null } });
  });

  it('returns zeroed KPIs and empty history when there are no snapshots', async () => {
    mockSnapshots([]);

    const result = await getDashboardData('user-1');

    expect(result.kpis).toEqual({
      netWorth: 0, assets: 0, liabilities: 0, asOf: null,
      monthChange: null, monthChangePct: null,
      yearChange: null, yearChangePct: null,
      totalGain: 0, totalGainPct: 0
    });
    expect(result.netWorthHistory).toEqual([]);
    expect(result.allocation).toEqual([]);
    expect(result.liabilities).toEqual([]);
    expect(result.currency).toBe('EUR');
    expect(result.holdings).toBeNull();
    expect(result.cashflow).toBeNull();
    expect(result.safety).toBeNull();
  });

  it('computes month, year, and total-gain KPIs across snapshots', async () => {
    mockSnapshots([
      // exactly one year before latest — used for the year-over-year comparison
      snap('2023-01-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 80, gain: 0 },
        { assetClassId: 'ac2', value: 20, gain: 0 }
      ]), // total 100
      // previous month
      snap('2023-12-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 120, gain: 0 },
        { assetClassId: 'ac2', value: 60, gain: 0 }
      ]), // total 180
      // latest
      snap('2024-01-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 200, gain: 40 },
        { assetClassId: 'ac2', value: 100, gain: 10 }
      ]) // total 300, gain 50, invested 250
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.netWorth).toBe(300);
    expect(kpis.asOf).toBe('2024-01-01T00:00:00.000Z');
    // vs previous month (180)
    expect(kpis.monthChange).toBe(120);
    expect(kpis.monthChangePct).toBeCloseTo((120 / 180) * 100, 5);
    // vs one year back (100)
    expect(kpis.yearChange).toBe(200);
    expect(kpis.yearChangePct).toBeCloseTo(200, 5);
    // gain = 40 + 10 = 50, invested = 300 - 50 = 250
    expect(kpis.totalGain).toBe(50);
    expect(kpis.totalGainPct).toBeCloseTo((50 / 250) * 100, 5);
  });

  it('builds allocation sorted by value desc with per-class percentages and colors', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [
        { assetClassId: 'ac2', value: 100, gain: 5 },
        { assetClassId: 'ac1', value: 300, gain: 20 }
      ]) // total 400
    ]);

    const { allocation, assetColors } = await getDashboardData('user-1');

    expect(allocation.map((a) => a.name)).toEqual(['Stocks', 'Cash']); // sorted desc by value
    expect(allocation[0]).toMatchObject({ name: 'Stocks', value: 300, gain: 20, color: '#111' });
    expect(allocation[0].percentage).toBeCloseTo(75, 5);
    expect(allocation[1].percentage).toBeCloseTo(25, 5);
    expect(assetColors).toEqual({ Stocks: '#111', Cash: '#222', Mortgage: '#333' });
  });

  it('groups netWorthHistory per class by name', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 50, gain: 0 },
        { assetClassId: 'ac1', value: 25, gain: 0 }, // same class, should sum
        { assetClassId: 'ac2', value: 10, gain: 0 }
      ])
    ]);

    const { netWorthHistory } = await getDashboardData('user-1');

    expect(netWorthHistory).toHaveLength(1);
    expect(netWorthHistory[0].total).toBe(85);
    expect(netWorthHistory[0].byClass).toEqual({ Stocks: 75, Cash: 10 });
  });

  it('labels entries with an unknown asset class as "Unknown"', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [{ assetClassId: 'missing', value: 10, gain: 0 }])
    ]);

    const { allocation } = await getDashboardData('user-1');

    expect(allocation[0]).toMatchObject({ name: 'Unknown', color: '#667eea' });
  });

  it('reports month/year change as unknown when there is only one snapshot', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [{ assetClassId: 'ac1', value: 100, gain: 20 }])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.monthChange).toBeNull();
    expect(kpis.monthChangePct).toBeNull();
    expect(kpis.yearChange).toBeNull();
    expect(kpis.yearChangePct).toBeNull();
    expect(kpis.totalGain).toBe(20);
    expect(kpis.totalGainPct).toBeCloseTo((20 / 80) * 100, 5); // invested = 100 - 20
  });

  it('reports month change as unknown when the previous month has no check-in', async () => {
    // A two-month gap: the older snapshot must not be passed off as "past month".
    mockSnapshots([
      snap('2023-11-01T00:00:00Z', [{ assetClassId: 'ac1', value: 100, gain: 0 }]),
      snap('2024-01-01T00:00:00Z', [{ assetClassId: 'ac1', value: 300, gain: 0 }])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.monthChange).toBeNull();
    expect(kpis.monthChangePct).toBeNull();
  });

  it('uses the check-in exactly twelve months back, not merely the nearest older one', async () => {
    mockSnapshots([
      // Two years back — must be ignored for the year comparison.
      snap('2022-01-01T00:00:00Z', [{ assetClassId: 'ac1', value: 10, gain: 0 }]),
      snap('2023-12-01T00:00:00Z', [{ assetClassId: 'ac1', value: 250, gain: 0 }]),
      snap('2024-01-01T00:00:00Z', [{ assetClassId: 'ac1', value: 300, gain: 0 }])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.monthChange).toBe(50);
    expect(kpis.yearChange).toBeNull();
  });

  it('handles a December-to-January month rollover', async () => {
    mockSnapshots([
      snap('2023-12-01T00:00:00Z', [{ assetClassId: 'ac1', value: 100, gain: 0 }]),
      snap('2024-01-01T00:00:00Z', [{ assetClassId: 'ac1', value: 150, gain: 0 }])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.monthChange).toBe(50);
    expect(kpis.monthChangePct).toBeCloseTo(50, 5);
  });

  it('withholds a percentage when the baseline is not positive', async () => {
    mockSnapshots([
      snap('2023-12-01T00:00:00Z', [{ assetClassId: 'ac3', value: 100, gain: 0 }]), // net -100
      snap('2024-01-01T00:00:00Z', [{ assetClassId: 'ac1', value: 50, gain: 0 }])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.monthChange).toBe(150);
    expect(kpis.monthChangePct).toBeNull();
  });

  it('summarizes live holdings, counting only priced positions toward value/gain', async () => {
    mockSnapshots([]);
    mockedGetAllHoldings.mockResolvedValue([
      { currentValue: 500, valueIncrease: 100, costBasis: 400 }, // priced
      { costBasis: 50 } // unpriced
    ]);

    const { holdings } = await getDashboardData('user-1');

    expect(holdings).not.toBeNull();
    expect(holdings!.count).toBe(2); // both count
    expect(holdings!.totalValue).toBe(500); // only priced
    expect(holdings!.totalCost).toBe(450); // 400 + 50
    expect(holdings!.gain).toBe(100);
    expect(holdings!.gainPct).toBeCloseTo((100 / 450) * 100, 5);
    expect(holdings!.unconverted).toBe(0);
  });

  it('counts dividends and realised gains from positions since sold out of', async () => {
    mockSnapshots([]);
    mockedGetAllHoldings.mockResolvedValue([
      { currentValue: 500, valueIncrease: 100, costBasis: 400, dividends: 40, realizedGain: 5 }
    ]);
    mockedClosed.mockResolvedValue([
      { ticker: 'VGWD', dividends: 176.36, realizedGain: 25, missingFxRate: false },
      { ticker: 'ZPRR', dividends: 0, realizedGain: 2402, missingFxRate: false },
      { ticker: 'US', dividends: 9, realizedGain: 9, missingFxRate: true } // no rate: left out
    ]);

    const { holdings } = await getDashboardData('user-1');

    expect(holdings!.dividends).toBeCloseTo(216.36, 6);
    expect(holdings!.realizedGain).toBeCloseTo(2432, 6);
  });

  it('excludes holdings with no exchange rate from the totals and counts them', async () => {
    mockSnapshots([]);
    mockedGetAllHoldings.mockResolvedValue([
      { currentValue: 500, valueIncrease: 100, costBasis: 400 },
      { missingFxRate: true, currency: 'JPY' } // no converted amounts at all
    ]);

    const { holdings } = await getDashboardData('user-1');

    expect(holdings!.count).toBe(2);
    expect(holdings!.totalValue).toBe(500);
    expect(holdings!.totalCost).toBe(400);
    expect(holdings!.unconverted).toBe(1);
  });

  it('scopes the query by groupId when provided, else by userId with no group', async () => {
    mockSnapshots([]);

    await getDashboardData('user-1', 'group-9');
    expect(mockedSnapshotFind).toHaveBeenCalledWith({ groupId: 'group-9' });
    expect(mockedGetAllHoldings).toHaveBeenCalledWith('user-1', ['group-9']);

    await getDashboardData('user-1');
    expect(mockedSnapshotFind).toHaveBeenCalledWith({
      userId: 'user-1',
      $or: [{ groupId: { $exists: false } }, { groupId: null }]
    });
    expect(mockedGetAllHoldings).toHaveBeenCalledWith('user-1', []);
  });
});

describe('getDashboardData — liabilities', () => {
  beforeEach(() => {
    mockedAssetClassFind.mockResolvedValue(assetClasses);
    mockedGetAllHoldings.mockResolvedValue([]);
    mockedClosed.mockResolvedValue([]);
    mockedCashflow.mockResolvedValue({ months: [], categories: [], totals: {}, growth: null });
    mockedAnalytics.mockResolvedValue({ months: [], trailing: { current: {}, previous: null } });
  });

  it('subtracts liability classes from net worth and reports both sides', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 200, gain: 0 },
        { assetClassId: 'ac2', value: 50, gain: 0 },
        { assetClassId: 'ac3', value: 90, gain: 0 } // mortgage
      ])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.assets).toBe(250);
    expect(kpis.liabilities).toBe(90);
    expect(kpis.netWorth).toBe(160);
  });

  it('keeps liabilities out of the allocation donut and lists them separately', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 300, gain: 0 },
        { assetClassId: 'ac3', value: 100, gain: 0 }
      ])
    ]);

    const { allocation, liabilities } = await getDashboardData('user-1');

    expect(allocation.map((a) => a.name)).toEqual(['Stocks']);
    // Share of gross assets, so it cannot exceed 100% once debt exists
    expect(allocation[0].percentage).toBe(100);
    expect(liabilities).toEqual([
      { assetClassId: 'ac3', name: 'Mortgage', color: '#333', value: 100 }
    ]);
  });

  it('signs liabilities negative in the chart series so it sums to the net line', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 300, gain: 0 },
        { assetClassId: 'ac3', value: 100, gain: 0 }
      ])
    ]);

    const { netWorthHistory } = await getDashboardData('user-1');

    expect(netWorthHistory[0]).toMatchObject({ total: 200, assets: 300, liabilities: 100 });
    expect(netWorthHistory[0].byClass).toEqual({ Stocks: 300, Mortgage: -100 });
  });

  it('measures month-on-month change on the net figure, not on gross assets', async () => {
    mockSnapshots([
      snap('2023-12-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 300, gain: 0 },
        { assetClassId: 'ac3', value: 200, gain: 0 } // net 100
      ]),
      snap('2024-01-01T00:00:00Z', [
        { assetClassId: 'ac1', value: 300, gain: 0 },
        { assetClassId: 'ac3', value: 150, gain: 0 } // net 150 — debt paid down
      ])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.monthChange).toBe(50);
  });

  it('treats a class with no kind stored as an asset', async () => {
    mockedAssetClassFind.mockResolvedValue([{ _id: 'ac9', name: 'Legacy', color: '#999' }]);
    mockSnapshots([snap('2024-01-01T00:00:00Z', [{ assetClassId: 'ac9', value: 40, gain: 0 }])]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.assets).toBe(40);
    expect(kpis.netWorth).toBe(40);
  });
});

describe('getDashboardData — safety', () => {
  const sorted = [
    { _id: 'cash', name: 'Cash', color: '#1', kind: 'asset', liquidity: 'cash' },
    { _id: 'fund', name: 'Funds', color: '#2', kind: 'asset', liquidity: 'market' },
    { _id: 'pens', name: 'Pension', color: '#3', kind: 'asset', liquidity: 'locked' },
    { _id: 'misc', name: 'Gold', color: '#4', kind: 'asset' }
  ];
  const entries = [
    { assetClassId: 'cash', value: 9000, gain: 0 },
    { assetClassId: 'fund', value: 260_000, gain: 0 },
    { assetClassId: 'pens', value: 97_000, gain: 0 },
    { assetClassId: 'misc', value: 4500, gain: 0 }
  ];

  beforeEach(() => {
    mockedAssetClassFind.mockResolvedValue(sorted);
    mockedGetAllHoldings.mockResolvedValue([]);
    mockedClosed.mockResolvedValue([]);
    mockedCashflow.mockResolvedValue({ months: [], categories: [], totals: {}, growth: null });
    mockedAnalytics.mockResolvedValue({
      months: [{}],
      trailing: { current: { consumption: 27_600, months: 12 }, previous: null }
    });
    mockSnapshots([snap('2026-10-01T00:00:00Z', entries)]);
  });

  it('splits the money by how reachable it is, and says what is not sorted yet', async () => {
    const { safety } = await getDashboardData('user-1');

    expect(safety).toMatchObject({ cash: 9000, market: 260_000, locked: 97_000, unsorted: 4500 });
  });

  it('says how many months of spending each reachable part covers', async () => {
    const { safety } = await getDashboardData('user-1');

    expect(safety!.monthlySpending).toBe(2300); // 27,600 consumed over 12 months
    expect(safety!.cashMonths).toBeCloseTo(9000 / 2300, 6);
    expect(safety!.reachableMonths).toBeCloseTo(269_000 / 2300, 6);
  });

  it('gives no runway when there is no spending to measure it against', async () => {
    mockedAnalytics.mockResolvedValue({ months: [], trailing: { current: {}, previous: null } });

    const { safety } = await getDashboardData('user-1');

    expect(safety).toMatchObject({ cash: 9000, monthlySpending: null, cashMonths: null, reachableMonths: null });
  });

  it('carries each class liquidity on the allocation', async () => {
    const { allocation } = await getDashboardData('user-1');

    expect(allocation.find((a) => a.name === 'Cash')?.liquidity).toBe('cash');
    expect(allocation.find((a) => a.name === 'Gold')).not.toHaveProperty('liquidity');
  });
});

describe('getDashboardData — growth split', () => {
  const trailing = { from: '2025-11', to: '2026-11', months: 12, netWorthChange: 87844, contributions: 35871, marketGrowth: 51973, complete: true };
  const monthly = { from: '2026-10', to: '2026-11', months: 1, netWorthChange: 5623, contributions: 3603, marketGrowth: 2020, complete: true };

  beforeEach(() => {
    mockedAssetClassFind.mockResolvedValue(assetClasses);
    mockedGetAllHoldings.mockResolvedValue([]);
    mockedClosed.mockResolvedValue([]);
    mockSnapshots([]);
    mockedAnalytics.mockResolvedValue({
      months: [{}],
      trailing: { current: { consumption: 27_600, months: 12 }, previous: null }
    });
  });

  it('explains the past year, not only the last month', async () => {
    mockedCashflow.mockResolvedValue({ months: [], categories: [], totals: {}, growth: monthly, growthTrailing: trailing });

    const { cashflow } = await getDashboardData('user-1');

    expect(cashflow!.growth).toEqual(trailing);
  });

  it('falls back to the month while there is not yet a year of check-ins', async () => {
    mockedCashflow.mockResolvedValue({ months: [], categories: [], totals: {}, growth: monthly, growthTrailing: null });

    const { cashflow } = await getDashboardData('user-1');

    expect(cashflow!.growth).toEqual(monthly);
  });

  it('falls back to the month when a month of the year has no transactions', async () => {
    mockedCashflow.mockResolvedValue({
      months: [], categories: [], totals: {}, growth: monthly, growthTrailing: { ...trailing, complete: false }
    });

    const { cashflow } = await getDashboardData('user-1');

    expect(cashflow!.growth).toEqual(monthly);
  });

  it('sends no split when neither can be explained', async () => {
    mockedCashflow.mockResolvedValue({
      months: [], categories: [], totals: {},
      growth: { ...monthly, complete: false }, growthTrailing: { ...trailing, complete: false }
    });

    const { cashflow } = await getDashboardData('user-1');

    expect(cashflow!.growth).toBeNull();
  });
});
