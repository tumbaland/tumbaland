import { Request, Response } from 'express';
import { getRelationshipStatistics, getMonthlyHours, getMonthlyStatistics, getMonthlyActivityBreakdown, getWeeklyHeatmapData } from '../services/statistics.service';

// Get relationship statistics
export const getStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeframe } = req.query;
    
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

    const statistics = await getRelationshipStatistics(selectedTimeframe);
    
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

// Get activity breakdown statistics
export const getActivityBreakdown = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeframe } = req.query;
    const selectedTimeframe = (timeframe as string) || 'all';
    
    const statistics = await getRelationshipStatistics(selectedTimeframe);
    
    res.json({
      success: true,
      data: {
        breakdown: statistics.activityBreakdown,
        totalActivities: statistics.totalActivities,
        timeframe: selectedTimeframe
      },
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error fetching activity breakdown:', error);
    res.status(500).json({
      error: 'Failed to fetch activity breakdown',
      message: error.message
    });
  }
};

// Get monthly hours statistics
export const getMonthlyHoursData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year } = req.query;
    const selectedYear = year ? parseInt(year as string) : undefined;
    
    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const monthlyHours = await getMonthlyHours(selectedYear);
    
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
    const { year } = req.query;
    const selectedYear = year ? parseInt(year as string) : undefined;
    
    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const monthlyStats = await getMonthlyStatistics(selectedYear);
    
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
    const { year } = req.query;
    const selectedYear = year ? parseInt(year as string) : undefined;
    
    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const monthlyActivityData = await getMonthlyActivityBreakdown(selectedYear);
    
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
    const { year } = req.query;
    const selectedYear = year ? parseInt(year as string) : undefined;
    
    // Validate year if provided
    if (year && (isNaN(selectedYear!) || selectedYear! < 2000 || selectedYear! > new Date().getFullYear() + 1)) {
      res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number between 2000 and next year'
      });
      return;
    }

    const heatmapData = await getWeeklyHeatmapData(selectedYear);
    
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
