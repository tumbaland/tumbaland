import { Request, Response } from 'express';
import { getDashboardData } from '../services/dashboard.service';

export interface DashboardResponse {
  kpis: {
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
  };
  portfolioHistory: Array<{
    date: string;
    totalValue: number;
    totalInvested: number;
  }>;
  assetAllocation: Array<{
    assetClass: string;
    percentage: number;
    value: number;
  }>;
}

export interface ErrorResponse {
  error: string;
}

// GET /api/dashboard
export const getDashboard = async (req: Request, res: Response<DashboardResponse | ErrorResponse>) => {
  try {
    const { groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    let groupIds: string[] = [];
    if (groupId) {
      // Get dashboard for specific group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      groupIds = [groupId as string];
    } else {
      // No groupId specified: show personal dashboard (no group)
      groupIds = [];
    }

    const dashboardData = await getDashboardData(user.id, groupIds);
    res.json(dashboardData);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};