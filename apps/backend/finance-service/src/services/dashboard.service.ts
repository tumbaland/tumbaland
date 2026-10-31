import Snapshot, { ISnapshot } from '../models/Snapshot';
import AssetClass, { AssetClassKind, AssetClassLiquidity } from '../models/AssetClass';
import { getAllHoldings } from './holding.service';
import { getClosedPositions } from './closedPosition.service';
import { BASE_CURRENCY } from './fxRate.service';
import { getCashflowSummary, GrowthBreakdown } from './cashflow.service';
import { getAnalytics, PeriodTotals } from './analytics.service';

export interface DashboardKPIs {
  /** Assets minus liabilities at the latest check-in. */
  netWorth: number;
  assets: number;
  liabilities: number;
  asOf: string | null; // date of the latest snapshot
  /**
   * Change over exactly one calendar month / one year. Null when there is no
   * check-in at that offset — a gap in the history must read as "unknown",
   * not as a change of zero or as a multi-month delta labelled as one month.
   */
  monthChange: number | null;
  monthChangePct: number | null;
  yearChange: number | null;
  yearChangePct: number | null;
  totalGain: number;
  totalGainPct: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  // One point per snapshot, per-class values keyed by class name (chart-ready)
  netWorthHistory: Array<{
    date: string;
    total: number;
    assets: number;
    liabilities: number;
    byClass: Record<string, number>;
  }>;
  // Latest snapshot broken down by class (assets only — see `liabilities`)
  allocation: Array<{
    assetClassId: string;
    name: string;
    color: string;
    /** How reachable it is; absent on classes that have not been sorted yet. */
    liquidity?: AssetClassLiquidity;
    value: number;
    gain: number;
    percentage: number;
  }>;
  liabilities: Array<{
    assetClassId: string;
    name: string;
    color: string;
    value: number;
  }>;
  assetColors: Record<string, string>;
  currency: string;
  /**
   * Why net worth moved, not just that it did.
   *
   * Headline figures are the trailing twelve months rather than the latest
   * month: the newest month is usually half-imported, so a card built on it
   * shows a collapse in income that never happened. The growth split is only
   * carried when it is actually complete — an unexplained split is worse than
   * none.
   */
  cashflow: {
    trailing: PeriodTotals;
    previous: PeriodTotals | null;
    growth: GrowthBreakdown | null;
  } | null;
  /**
   * Can the money be reached, and for how long would it last. Null until there
   * is a check-in to read it from.
   *
   * Spending is what was consumed over the trailing year, so buying funds does
   * not count as spending it. Runway is in months of that spending, before any
   * tax a sale would cost.
   */
  safety: {
    cash: number;
    market: number;
    locked: number;
    /** Assets in classes not yet marked as cash, market or locked. */
    unsorted: number;
    monthlySpending: number | null;
    cashMonths: number | null;
    /** Cash plus what can be sold within days. */
    reachableMonths: number | null;
  } | null;
  holdings: {
    count: number;
    totalValue: number;
    totalCost: number;
    gain: number;
    gainPct: number;
    /** Dividends received, from positions held and from ones since sold. */
    dividends: number;
    /** Gains crystallised by selling, held and sold positions together. */
    realizedGain: number;
    /** Holdings left out of the totals because no FX rate was available. */
    unconverted: number;
  } | null;
}

interface ClassMeta {
  name: string;
  color: string;
  kind: AssetClassKind;
  liquidity?: AssetClassLiquidity;
}

const UNKNOWN_CLASS: ClassMeta = { name: 'Unknown', color: '#667eea', kind: 'asset' };

/** Month key (YYYY-MM) shifted by `months`, used to find an exact-offset snapshot. */
function shiftMonth(date: Date, months: number): string {
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  return shifted.toISOString().slice(0, 7);
}

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

export const getDashboardData = async (userId: string, groupId?: string): Promise<DashboardData> => {
  const scope = groupId
    ? { groupId }
    : { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };

  const snapshots = await Snapshot.find(scope).sort({ date: 1 });
  const assetClasses = await AssetClass.find(scope);
  const classMap = new Map<string, ClassMeta>(
    assetClasses.map((ac) => [
      String(ac._id),
      { name: ac.name, color: ac.color || '#667eea', kind: ac.kind || 'asset', liquidity: ac.liquidity }
    ])
  );
  const classOf = (id: string): ClassMeta => classMap.get(id) || UNKNOWN_CLASS;

  /** Split a snapshot into positive asset and liability magnitudes. */
  const totals = (s: ISnapshot) =>
    s.entries.reduce(
      (acc, e) => {
        if (classOf(e.assetClassId).kind === 'liability') acc.liabilities += e.value;
        else acc.assets += e.value;
        return acc;
      },
      { assets: 0, liabilities: 0 }
    );

  const netOf = (s: ISnapshot) => {
    const { assets, liabilities } = totals(s);
    return assets - liabilities;
  };

  const netWorthHistory = snapshots.map((s) => {
    const byClass: Record<string, number> = {};
    s.entries.forEach((e) => {
      const { name, kind } = classOf(e.assetClassId);
      // Liabilities enter the chart negative so the stacked series still sums
      // to the net worth line.
      const signed = kind === 'liability' ? -e.value : e.value;
      byClass[name] = (byClass[name] || 0) + signed;
    });
    const { assets, liabilities } = totals(s);
    return { date: s.date.toISOString(), total: assets - liabilities, assets, liabilities, byClass };
  });

  const assetColors: Record<string, string> = {};
  classMap.forEach(({ name, color }) => { assetColors[name] = color; });

  // KPIs from the latest check-in vs. the check-ins exactly one month and one
  // year earlier.
  const latest = snapshots[snapshots.length - 1];
  const byMonth = new Map(snapshots.map((s) => [monthKey(s.date), s]));

  let kpis: DashboardKPIs = {
    netWorth: 0, assets: 0, liabilities: 0, asOf: null,
    monthChange: null, monthChangePct: null,
    yearChange: null, yearChangePct: null,
    totalGain: 0, totalGainPct: 0
  };

  let allocation: DashboardData['allocation'] = [];
  let liabilities: DashboardData['liabilities'] = [];

  if (latest) {
    const { assets, liabilities: debt } = totals(latest);
    const netWorth = assets - debt;

    const changeAgainst = (monthsBack: number) => {
      const previous = byMonth.get(shiftMonth(latest.date, -monthsBack));
      if (!previous) return { change: null, pct: null };
      const previousNet = netOf(previous);
      return {
        change: netWorth - previousNet,
        // A sign change through zero makes a percentage meaningless, so only
        // report one when the baseline is positive.
        pct: previousNet > 0 ? ((netWorth - previousNet) / previousNet) * 100 : null
      };
    };

    const month = changeAgainst(1);
    const year = changeAgainst(12);

    const totalGain = latest.entries.reduce((sum, e) => sum + e.gain, 0);
    const invested = assets - totalGain;

    kpis = {
      netWorth,
      assets,
      liabilities: debt,
      asOf: latest.date.toISOString(),
      monthChange: month.change,
      monthChangePct: month.pct,
      yearChange: year.change,
      yearChangePct: year.pct,
      totalGain,
      totalGainPct: invested > 0 ? (totalGain / invested) * 100 : 0
    };

    const entriesOfKind = (kind: AssetClassKind) =>
      latest.entries.filter((e) => classOf(e.assetClassId).kind === kind);

    allocation = entriesOfKind('asset')
      .map((e) => {
        const { name, color, liquidity } = classOf(e.assetClassId);
        return {
          assetClassId: e.assetClassId,
          name,
          color,
          ...(liquidity ? { liquidity } : {}),
          value: e.value,
          gain: e.gain,
          // Share of gross assets: a share of net worth would exceed 100% as
          // soon as any debt exists.
          percentage: assets > 0 ? (e.value / assets) * 100 : 0
        };
      })
      .sort((a, b) => b.value - a.value);

    liabilities = entriesOfKind('liability')
      .map((e) => {
        const { name, color } = classOf(e.assetClassId);
        return { assetClassId: e.assetClassId, name, color, value: e.value };
      })
      .sort((a, b) => b.value - a.value);
  }

  // Live holdings summary (ETF/stock positions with latest prices), already
  // converted to the base currency by the holding service.
  const [holdingsList, closedPositions, cashflow] = await Promise.all([
    getAllHoldings(userId, groupId ? [groupId] : []),
    getClosedPositions(userId, groupId ? [groupId] : []),
    getCashflowKpis(userId, groupId)
  ]);
  let holdings: DashboardData['holdings'] = null;
  if (holdingsList.length > 0) {
    const convertible = holdingsList.filter((h) => !h.missingFxRate);
    const priced = convertible.filter((h) => h.currentValue !== undefined);
    const totalValue = priced.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    const totalCost = convertible.reduce((sum, h) => sum + (h.costBasis || 0), 0);
    const gain = priced.reduce((sum, h) => sum + (h.valueIncrease || 0), 0);
    // What positions earned beyond their price: income and realised gains,
    // counting those since sold out of, whose holdings no longer exist.
    const sold = closedPositions.filter((p) => !p.missingFxRate);
    holdings = {
      count: holdingsList.length,
      totalValue,
      totalCost,
      gain,
      gainPct: totalCost > 0 ? (gain / totalCost) * 100 : 0,
      dividends:
        convertible.reduce((sum, h) => sum + (h.dividends || 0), 0) +
        sold.reduce((sum, p) => sum + (p.dividends || 0), 0),
      realizedGain:
        convertible.reduce((sum, h) => sum + (h.realizedGain || 0), 0) +
        sold.reduce((sum, p) => sum + (p.realizedGain || 0), 0),
      unconverted: holdingsList.length - convertible.length
    };
  }

  return {
    kpis,
    netWorthHistory,
    allocation,
    liabilities,
    assetColors,
    currency: BASE_CURRENCY,
    safety: latest ? getSafety(allocation, cashflow) : null,
    holdings,
    cashflow
  };
};

/**
 * The dashboard needs the headline cash-flow numbers, not the full breakdown,
 * so this trims the summary down rather than shipping every category and month.
 */
async function getCashflowKpis(userId: string, groupId?: string): Promise<DashboardData['cashflow']> {
  const [summary, analytics] = await Promise.all([
    getCashflowSummary(userId, { groupId }),
    getAnalytics(userId, groupId)
  ]);

  if (analytics.months.length === 0) return null;

  return {
    trailing: analytics.trailing.current,
    previous: analytics.trailing.previous,
    // The past year, which is what the headline figures are on and what is worth
    // judging: a single month of market movement is noise, and a month of
    // contributions is whatever the salary date landed on. Falls back to the
    // month while there is not yet a year of check-ins. Only when it can actually
    // be explained; the UI has nothing useful to say about a split covering a
    // month with no transactions.
    growth: summary.growthTrailing?.complete
      ? summary.growthTrailing
      : summary.growth?.complete
        ? summary.growth
        : null
  };
}

/**
 * How much of the money can be reached, and how many months of spending the
 * reachable part covers.
 */
function getSafety(
  allocation: DashboardData['allocation'],
  cashflow: DashboardData['cashflow']
): NonNullable<DashboardData['safety']> {
  const sum = (liquidity: AssetClassLiquidity | undefined) =>
    allocation.filter((a) => a.liquidity === liquidity).reduce((total, a) => total + a.value, 0);

  const cash = sum('cash');
  const market = sum('market');
  const trailing = cashflow?.trailing;
  const monthlySpending = trailing && trailing.months > 0 ? trailing.consumption / trailing.months : null;
  const monthsOf = (amount: number) => (monthlySpending && monthlySpending > 0 ? amount / monthlySpending : null);

  return {
    cash,
    market,
    locked: sum('locked'),
    unsorted: sum(undefined),
    monthlySpending,
    cashMonths: monthsOf(cash),
    reachableMonths: monthsOf(cash + market)
  };
}
