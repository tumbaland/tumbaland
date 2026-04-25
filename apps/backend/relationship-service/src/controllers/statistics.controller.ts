import { Request, Response } from 'express';
import {
  getRelationshipStatistics,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData
} from '../services/statistics.service';

/**
 * Get relationship statistics
 */
export const getStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeframe, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    const validTimeframes = ['week', 'month', 'quarter', 'year', 'all'];
    const selectedTimeframe = (timeframe as string) || 'all';
    if (!validTimeframes.includes(selectedTimeframe)) {
      res.status(400).json({
        success: false,
        message: 'Invalid timeframe. Must be one of: week, month, quarter, year, all'
      });
      return;
    }

    const filters: any = { userId: user.id };
    
    if (groupId) {
      filters.groupId = groupId as string;
    } else {
      filters.userGroupIds = userGroups;
      filters.personalOnly = true;
    }

    const statistics = await getRelationshipStatistics(selectedTimeframe, filters);

    res.json({
      success: true,
      data: statistics,
      timeframe: selectedTimeframe,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch statistics'
    });
  }
};

/**
 * Get monthly hours statistics
 */
export const getMonthlyHoursData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        success: false,
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const filters: any = { userId: user.id };
    
    if (groupId) {
      filters.groupId = groupId as string;
    } else {
      filters.userGroupIds = userGroups;
      filters.personalOnly = true;
    }

    const monthlyHours = await getMonthlyHours(selectedYear, filters);

    res.json({
      success: true,
      data: monthlyHours,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch monthly hours'
    });
  }
};

/**
 * Get monthly statistics (days breakdown)
 */
export const getMonthlyStatisticsData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        success: false,
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const filters: any = { userId: user.id };
    
    if (groupId) {
      filters.groupId = groupId as string;
    } else {
      filters.userGroupIds = userGroups;
      filters.personalOnly = true;
    }

    const monthlyStats = await getMonthlyStatistics(selectedYear, filters);

    res.json({
      success: true,
      data: monthlyStats,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch monthly statistics'
    });
  }
};

/**
 * Get monthly activity breakdown
 */
export const getMonthlyActivityBreakdownData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        success: false,
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const filters: any = { userId: user.id };
    
    if (groupId) {
      filters.groupId = groupId as string;
    } else {
      filters.userGroupIds = userGroups;
      filters.personalOnly = true;
    }

    const monthlyActivityData = await getMonthlyActivityBreakdown(selectedYear, filters);

    res.json({
      success: true,
      data: monthlyActivityData,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch monthly activity breakdown'
    });
  }
};

/**
 * Get weekly heatmap data
 */
export const getWeeklyHeatmapDataController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        success: false,
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const filters: any = { userId: user.id };
    
    if (groupId) {
      filters.groupId = groupId as string;
    } else {
      filters.userGroupIds = userGroups;
      filters.personalOnly = true;
    }

    const heatmapData = await getWeeklyHeatmapData(selectedYear, filters);

    res.json({
      success: true,
      data: heatmapData,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch weekly heatmap data'
    });
  }
};

/**
 * Get cumulative timeline data
 */
export const getCumulativeTimelineDataController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        success: false,
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const filters: any = { userId: user.id };
    
    if (groupId) {
      filters.groupId = groupId as string;
    } else {
      filters.userGroupIds = userGroups;
      filters.personalOnly = true;
    }

    const timelineData = await getCumulativeTimelineData(selectedYear, filters);

    res.json({
      success: true,
      data: timelineData,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch cumulative timeline data'
    });
  }
};
