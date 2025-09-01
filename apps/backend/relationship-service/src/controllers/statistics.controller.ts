import { Request, Response } from 'express';
import {
  getRelationshipStatistics,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData
} from '../services/statistics.service';

// Get relationship statistics
export const getStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeframe, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    // Validate timeframe parameter
    const validTimeframes = ['week', 'month', 'quarter', 'year', 'all'];
    const selectedTimeframe = (timeframe as string) || 'all';
    if (!validTimeframes.includes(selectedTimeframe)) {
      res.status(400).json({
        error: 'Invalid timeframe',
        message: 'Timeframe must be one of: week, month, quarter, year, all',
        validTimeframes
      });
      return;
    }

    // Create filters object
    const filters: any = { userId: user.id };
    
    if (groupId) {
      // Filter by specific group
      filters.groupId = groupId as string;
    } else {
      // Personal context - show only items without groupId (personal items only)
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
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
};

// Get monthly hours statistics
export const getMonthlyHoursData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    // Create filters object
    const filters: any = { userId: user.id };
    
    if (groupId) {
      // Filter by specific group
      filters.groupId = groupId as string;
    } else {
      // Personal context - show only items without groupId (personal items only)
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
    console.error('Error fetching monthly hours:', error);
    res.status(500).json({
      error: 'Failed to fetch monthly hours',
      message: error.message
    });
  }
};

// Get monthly statistics (days breakdown)
export const getMonthlyStatisticsData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    // Create filters object
    const filters: any = { userId: user.id };
    
    if (groupId) {
      // Filter by specific group
      filters.groupId = groupId as string;
    } else {
      // Personal context - show only items without groupId (personal items only)
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
    console.error('Error fetching monthly statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch monthly statistics',
      message: error.message
    });
  }
};

// Get monthly activity breakdown
export const getMonthlyActivityBreakdownData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    // Create filters object
    const filters: any = { userId: user.id };
    
    if (groupId) {
      // Filter by specific group
      filters.groupId = groupId as string;
    } else {
      // Personal context - show only items without groupId (personal items only)
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
    console.error('Error fetching monthly activity breakdown:', error);
    res.status(500).json({
      error: 'Failed to fetch monthly activity breakdown',
      message: error.message
    });
  }
};

// Get weekly heatmap data
export const getWeeklyHeatmapDataController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    // Create filters object
    const filters: any = { userId: user.id };
    
    if (groupId) {
      // Filter by specific group
      filters.groupId = groupId as string;
    } else {
      // Personal context - show only items without groupId (personal items only)
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
    console.error('Error fetching weekly heatmap data:', error);
    res.status(500).json({
      error: 'Failed to fetch weekly heatmap data',
      message: error.message
    });
  }
};

// Get cumulative timeline data
export const getCumulativeTimelineDataController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const selectedYear = year ? parseInt(year as string) : undefined;

    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    // Create filters object
    const filters: any = { userId: user.id };
    
    if (groupId) {
      // Filter by specific group
      filters.groupId = groupId as string;
    } else {
      // Personal context - show only items without groupId (personal items only)
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
    console.error('Error fetching cumulative timeline data:', error);
    res.status(500).json({
      error: 'Failed to fetch cumulative timeline data',
      message: error.message
    });
  }
};
