import { getAssetAllocationsByGroup, getPersonalAssetAllocations } from './assetAllocation.service';
import AssetClass from '../models/AssetClass';

export interface DashboardKPIs {
  totalPortfolioValue: number;
  totalInvested: number;
  totalGains: number;
  totalGainsPercentage: number;
  monthlyChange: number;
  monthlyChangePercentage: number;
  assetBreakdown: {
    stocks: number;
    etfs: number;
    cash: number;
    other: number;
  };
  topPerformers: Array<{
    symbol: string;
    currentValue: number;
    percentIncrease: number;
  }>;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  portfolioHistory: Array<{
    date: string;
    totalValue: number;
    totalInvested: number;
    assetBreakdown: {
      [assetClass: string]: number;
    };
  }>;
  assetAllocation: Array<{
    assetClass: string;
    percentage: number;
    value: number;
  }>;
}

/**
 * Calculate dashboard KPIs from asset allocations over time
 */
export const calculateDashboardKPIs = async (userId: string, groupIds: string[] = []): Promise<DashboardKPIs> => {
  // Get asset allocations
  let allocations = [];
  if (groupIds.length > 0) {
    // Get allocations for groups
    for (const groupId of groupIds) {
      const groupAllocations = await getAssetAllocationsByGroup(groupId, userId, groupIds);
      allocations.push(...groupAllocations);
    }
  } else {
    // Get personal allocations
    allocations = await getPersonalAssetAllocations(userId);
  }

  if (!allocations || allocations.length === 0) {
    return {
      totalPortfolioValue: 0,
      totalInvested: 0,
      totalGains: 0,
      totalGainsPercentage: 0,
      monthlyChange: 0,
      monthlyChangePercentage: 0,
      assetBreakdown: { stocks: 0, etfs: 0, cash: 0, other: 0 },
      topPerformers: []
    };
  }

  // Group allocations by date
  const allocationsByDate = new Map<string, any[]>();
  allocations.forEach(allocation => {
    const dateKey = allocation.date.toISOString().split('T')[0];
    if (!allocationsByDate.has(dateKey)) {
      allocationsByDate.set(dateKey, []);
    }
    allocationsByDate.get(dateKey)!.push(allocation);
  });

  // Sort dates
  const sortedDates = Array.from(allocationsByDate.keys()).sort();

  if (sortedDates.length === 0) {
    return {
      totalPortfolioValue: 0,
      totalInvested: 0,
      totalGains: 0,
      totalGainsPercentage: 0,
      monthlyChange: 0,
      monthlyChangePercentage: 0,
      assetBreakdown: { stocks: 0, etfs: 0, cash: 0, other: 0 },
      topPerformers: []
    };
  }

  // Get latest date data
  const latestDate = sortedDates[sortedDates.length - 1];
  const latestAllocations = allocationsByDate.get(latestDate) || [];

  // Calculate latest totals
  const totalValue = latestAllocations.reduce((sum, a) => sum + a.totalValue, 0);
  const totalGains = latestAllocations.reduce((sum, a) => sum + a.gain, 0);
  const totalInvested = totalValue - totalGains;
  const totalGainsPercentage = totalInvested > 0 ? (totalGains / totalInvested) * 100 : 0;

  // Calculate monthly change (difference between last two dates)
  let monthlyChange = 0;
  let monthlyChangePercentage = 0;

  if (sortedDates.length >= 2) {
    const previousDate = sortedDates[sortedDates.length - 2];
    const previousAllocations = allocationsByDate.get(previousDate) || [];
    const previousTotal = previousAllocations.reduce((sum, a) => sum + a.totalValue, 0);

    monthlyChange = totalValue - previousTotal;
    monthlyChangePercentage = previousTotal > 0 ? (monthlyChange / previousTotal) * 100 : 0;
  }

  // Get asset class names for breakdown
  const assetClassIds = allocations.map(a => a.assetClassId);
  const assetClasses = await AssetClass.find({ _id: { $in: assetClassIds } });
  const assetClassMap = new Map();
  assetClasses.forEach(ac => assetClassMap.set(ac._id.toString(), ac.name.toLowerCase()));

  // Calculate asset breakdown from latest allocations
  const assetBreakdown = { stocks: 0, etfs: 0, cash: 0, other: 0 };
  latestAllocations.forEach(allocation => {
    const className = assetClassMap.get(allocation.assetClassId) || 'other';
    if (className.includes('stock')) {
      assetBreakdown.stocks += allocation.totalValue;
    } else if (className.includes('etf') || className.includes('fund')) {
      assetBreakdown.etfs += allocation.totalValue;
    } else if (className.includes('cash')) {
      assetBreakdown.cash += allocation.totalValue;
    } else {
      assetBreakdown.other += allocation.totalValue;
    }
  });

  // Top performers (simplified - would need more complex logic)
  const topPerformers = latestAllocations
    .filter(a => a.gain !== undefined && a.totalValue > 0)
    .sort((a, b) => (b.gain / b.totalValue) - (a.gain / a.totalValue))
    .slice(0, 5)
    .map(a => ({
      symbol: assetClassMap.get(a.assetClassId) || 'Unknown',
      currentValue: a.totalValue,
      percentIncrease: a.totalValue > 0 ? (a.gain / (a.totalValue - a.gain)) * 100 : 0
    }));

  return {
    totalPortfolioValue: totalValue,
    totalInvested,
    totalGains,
    totalGainsPercentage,
    monthlyChange,
    monthlyChangePercentage,
    assetBreakdown,
    topPerformers
  };
};

/**
 * Get complete dashboard data
 */
export const getDashboardData = async (userId: string, groupIds: string[] = []): Promise<DashboardData> => {
  const kpis = await calculateDashboardKPIs(userId, groupIds);

  // Get asset allocations for allocation chart
  let allocations = [];
  if (groupIds.length > 0) {
    // Get allocations for groups
    for (const groupId of groupIds) {
      const groupAllocations = await getAssetAllocationsByGroup(groupId, userId, groupIds);
      allocations.push(...groupAllocations);
    }
  } else {
    // Get personal allocations
    allocations = await getPersonalAssetAllocations(userId);
  }

  // Process asset allocations for chart
  const assetAllocation: Array<{
    assetClass: string;
    percentage: number;
    value: number;
    color?: string;
  }> = [];

  if (allocations.length > 0) {
    // Get total value for percentage calculation
    const totalAllocationValue = allocations.reduce((sum, a) => sum + a.totalValue, 0);

    // Get asset class names and colors
    const assetClassIds = allocations.map(a => a.assetClassId);
    const assetClasses = await AssetClass.find({ _id: { $in: assetClassIds } });

    // Create asset class map
    const assetClassMap = new Map();
    assetClasses.forEach(ac => assetClassMap.set(ac._id.toString(), { name: ac.name, color: ac.color }));

    // Process allocations
    allocations.forEach(allocation => {
      const assetClassData = assetClassMap.get(allocation.assetClassId) || { name: 'Unknown', color: '#667eea' };
      const percentage = totalAllocationValue > 0 ? (allocation.totalValue / totalAllocationValue) * 100 : 0;

      assetAllocation.push({
        assetClass: assetClassData.name,
        percentage,
        value: allocation.totalValue,
        color: assetClassData.color
      });
    });
  }

  // Generate portfolio history (placeholder - would need historical tracking)
  const portfolioHistory = await generatePortfolioHistory(allocations);

  return {
    kpis,
    portfolioHistory,
    assetAllocation
  };
};

/**
 * Generate portfolio history data from asset allocations
 */
const generatePortfolioHistory = async (allocations: any[]): Promise<Array<{ date: string; totalValue: number; totalInvested: number; assetBreakdown: { [assetClass: string]: number; } }>> => {
  // Group allocations by date
  const allocationsByDate = new Map<string, any[]>();
  allocations.forEach(allocation => {
    const dateKey = allocation.date.toISOString().split('T')[0];
    if (!allocationsByDate.has(dateKey)) {
      allocationsByDate.set(dateKey, []);
    }
    allocationsByDate.get(dateKey)!.push(allocation);
  });

  // Get asset class names
  const assetClassIds = allocations.map(a => a.assetClassId);
  const assetClasses = await AssetClass.find({ _id: { $in: assetClassIds } });
  const assetClassMap = new Map();
  assetClasses.forEach(ac => assetClassMap.set(ac._id.toString(), ac.name));

  // Sort dates and create history
  const sortedDates = Array.from(allocationsByDate.keys()).sort();

  return sortedDates.map(date => {
    const dayAllocations = allocationsByDate.get(date) || [];
    const totalValue = dayAllocations.reduce((sum, a) => sum + a.totalValue, 0);
    const totalGains = dayAllocations.reduce((sum, a) => sum + a.gain, 0);
    const totalInvested = totalValue - totalGains;

    // Create asset breakdown
    const assetBreakdown: { [assetClass: string]: number } = {};
    dayAllocations.forEach(allocation => {
      const className = assetClassMap.get(allocation.assetClassId) || 'Unknown';
      assetBreakdown[className] = (assetBreakdown[className] || 0) + allocation.totalValue;
    });

    return {
      date,
      totalValue: Math.round(totalValue),
      totalInvested: Math.round(totalInvested),
      assetBreakdown
    };
  });
};