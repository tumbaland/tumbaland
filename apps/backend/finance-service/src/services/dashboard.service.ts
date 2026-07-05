import Snapshot, { ISnapshot } from '../models/Snapshot';
import AssetClass from '../models/AssetClass';
import { getAllHoldings } from './holding.service';

export interface DashboardKPIs {
  netWorth: number;
  asOf: string | null; // date of the latest snapshot
  monthChange: number;
  monthChangePct: number;
  yearChange: number;
  yearChangePct: number;
  totalGain: number;
  totalGainPct: number;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  // One point per snapshot, per-class values keyed by class name (chart-ready)
  netWorthHistory: Array<{ date: string; total: number; byClass: Record<string, number> }>;
  // Latest snapshot broken down by class
  allocation: Array<{
    assetClassId: string;
    name: string;
    color: string;
    value: number;
    gain: number;
    percentage: number;
  }>;
  assetColors: Record<string, string>;
  holdings: {
    count: number;
    totalValue: number;
    totalCost: number;
    gain: number;
    gainPct: number;
  } | null;
}

const total = (s: ISnapshot) => s.entries.reduce((sum, e) => sum + e.value, 0);

export const getDashboardData = async (userId: string, groupId?: string): Promise<DashboardData> => {
  const scope = groupId
    ? { groupId }
    : { userId, $or: [{ groupId: { $exists: false } }, { groupId: null }] };

  const snapshots = await Snapshot.find(scope).sort({ date: 1 });
  const assetClasses = await AssetClass.find(scope);
  const classMap = new Map(assetClasses.map((ac) => [String(ac._id), { name: ac.name, color: ac.color || '#667eea' }]));
  const classOf = (id: string) => classMap.get(id) || { name: 'Unknown', color: '#667eea' };

  const netWorthHistory = snapshots.map((s) => {
    const byClass: Record<string, number> = {};
    s.entries.forEach((e) => {
      const { name } = classOf(e.assetClassId);
      byClass[name] = (byClass[name] || 0) + e.value;
    });
    return { date: s.date.toISOString(), total: total(s), byClass };
  });

  const assetColors: Record<string, string> = {};
  classMap.forEach(({ name, color }) => { assetColors[name] = color; });

  // KPIs from the latest snapshot vs. previous month / one year back
  const latest = snapshots[snapshots.length - 1];
  const previous = snapshots[snapshots.length - 2];

  let kpis: DashboardKPIs = {
    netWorth: 0, asOf: null,
    monthChange: 0, monthChangePct: 0,
    yearChange: 0, yearChangePct: 0,
    totalGain: 0, totalGainPct: 0
  };

  let allocation: DashboardData['allocation'] = [];

  if (latest) {
    const netWorth = total(latest);
    const prevTotal = previous ? total(previous) : undefined;

    const yearAgoDate = new Date(latest.date);
    yearAgoDate.setUTCFullYear(yearAgoDate.getUTCFullYear() - 1);
    // Latest snapshot at or before 12 months back
    const yearAgo = [...snapshots].reverse().find((s) => s.date <= yearAgoDate);
    const yearAgoTotal = yearAgo ? total(yearAgo) : undefined;

    const totalGain = latest.entries.reduce((sum, e) => sum + e.gain, 0);
    const invested = netWorth - totalGain;

    kpis = {
      netWorth,
      asOf: latest.date.toISOString(),
      monthChange: prevTotal !== undefined ? netWorth - prevTotal : 0,
      monthChangePct: prevTotal ? ((netWorth - prevTotal) / prevTotal) * 100 : 0,
      yearChange: yearAgoTotal !== undefined ? netWorth - yearAgoTotal : 0,
      yearChangePct: yearAgoTotal ? ((netWorth - yearAgoTotal) / yearAgoTotal) * 100 : 0,
      totalGain,
      totalGainPct: invested > 0 ? (totalGain / invested) * 100 : 0
    };

    allocation = latest.entries
      .map((e) => {
        const { name, color } = classOf(e.assetClassId);
        return {
          assetClassId: e.assetClassId,
          name,
          color,
          value: e.value,
          gain: e.gain,
          percentage: netWorth > 0 ? (e.value / netWorth) * 100 : 0
        };
      })
      .sort((a, b) => b.value - a.value);
  }

  // Live holdings summary (ETF/stock positions with latest prices)
  const holdingsList = await getAllHoldings(userId, groupId ? [groupId] : []);
  let holdings: DashboardData['holdings'] = null;
  if (holdingsList.length > 0) {
    const priced = holdingsList.filter((h) => h.currentValue !== undefined);
    const totalValue = priced.reduce((sum, h) => sum + (h.currentValue || 0), 0);
    const totalCost = holdingsList.reduce((sum, h) => sum + h.avgBuyPrice * h.quantity, 0);
    const gain = priced.reduce((sum, h) => sum + (h.valueIncrease || 0), 0);
    holdings = {
      count: holdingsList.length,
      totalValue,
      totalCost,
      gain,
      gainPct: totalCost > 0 ? (gain / totalCost) * 100 : 0
    };
  }

  return { kpis, netWorthHistory, allocation, assetColors, holdings };
};
