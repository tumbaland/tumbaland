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

import Snapshot from '../models/Snapshot';
import AssetClass from '../models/AssetClass';
import { getAllHoldings } from './holding.service';
import { getDashboardData } from './dashboard.service';

const mockedSnapshotFind = Snapshot.find as unknown as jest.Mock;
const mockedAssetClassFind = AssetClass.find as unknown as jest.Mock;
const mockedGetAllHoldings = getAllHoldings as unknown as jest.Mock;

// Snapshot.find(...).sort({ date: 1 }) — the service awaits the .sort() result.
const mockSnapshots = (snapshots: unknown[]) => {
  mockedSnapshotFind.mockReturnValue({ sort: jest.fn().mockResolvedValue(snapshots) });
};

const snap = (date: string, entries: Array<{ assetClassId: string; value: number; gain: number }>) => ({
  date: new Date(date),
  entries
});

const assetClasses = [
  { _id: 'ac1', name: 'Stocks', color: '#111' },
  { _id: 'ac2', name: 'Cash', color: '#222' }
];

describe('getDashboardData', () => {
  beforeEach(() => {
    mockedAssetClassFind.mockResolvedValue(assetClasses);
    mockedGetAllHoldings.mockResolvedValue([]);
  });

  it('returns zeroed KPIs and empty history when there are no snapshots', async () => {
    mockSnapshots([]);

    const result = await getDashboardData('user-1');

    expect(result.kpis).toEqual({
      netWorth: 0, asOf: null,
      monthChange: 0, monthChangePct: 0,
      yearChange: 0, yearChangePct: 0,
      totalGain: 0, totalGainPct: 0
    });
    expect(result.netWorthHistory).toEqual([]);
    expect(result.allocation).toEqual([]);
    expect(result.holdings).toBeNull();
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
    expect(assetColors).toEqual({ Stocks: '#111', Cash: '#222' });
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

  it('zeroes month/year KPIs when there is only one snapshot', async () => {
    mockSnapshots([
      snap('2024-01-01T00:00:00Z', [{ assetClassId: 'ac1', value: 100, gain: 20 }])
    ]);

    const { kpis } = await getDashboardData('user-1');

    expect(kpis.monthChange).toBe(0);
    expect(kpis.monthChangePct).toBe(0);
    expect(kpis.yearChange).toBe(0);
    expect(kpis.yearChangePct).toBe(0);
    expect(kpis.totalGain).toBe(20);
    expect(kpis.totalGainPct).toBeCloseTo((20 / 80) * 100, 5); // invested = 100 - 20
  });

  it('summarizes live holdings, counting only priced positions toward value/gain', async () => {
    mockSnapshots([]);
    mockedGetAllHoldings.mockResolvedValue([
      { currentValue: 500, valueIncrease: 100, avgBuyPrice: 10, quantity: 40 }, // priced, cost 400
      { avgBuyPrice: 5, quantity: 10 } // unpriced, cost 50
    ]);

    const { holdings } = await getDashboardData('user-1');

    expect(holdings).not.toBeNull();
    expect(holdings!.count).toBe(2); // both count
    expect(holdings!.totalValue).toBe(500); // only priced
    expect(holdings!.totalCost).toBe(450); // 400 + 50
    expect(holdings!.gain).toBe(100);
    expect(holdings!.gainPct).toBeCloseTo((100 / 450) * 100, 5);
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
