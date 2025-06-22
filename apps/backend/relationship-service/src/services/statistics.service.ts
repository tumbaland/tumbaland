import { Activity } from '../models/Activity';

export interface RelationshipStatistics {
  totalHoursTogether: number;
  sexActivityDays: number;
  totalActivities: number;
  activitiesThisMonth: number;
  avgHoursPerDay: number;
  daysTogether: number;
  mostFrequentActivity: {
    type: string;
    count: number;
  };
  activityBreakdown: {
    type: string;
    count: number;
    totalHours: number;
    percentage: number;
  }[];
  recentTrends: {
    weeklyAverage: number;
    monthlyAverage: number;
    lastWeekHours: number;
    lastMonthHours: number;
  };
  timeframe: {
    startDate: Date;
    endDate: Date;
    description: string;
  };
}

export interface MonthlyHoursData {
  month: string;
  year: number;
  hours: number;
  activities: number;
}

export const getRelationshipStatistics = async (timeframe: string = 'all'): Promise<RelationshipStatistics> => {
  try {
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate: Date;
    let description: string;

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        description = 'Last 7 days';
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        description = 'This month';
        break;
      case 'quarter':
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        description = 'This quarter';
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        description = 'This year';
        break;
      default:
        startDate = new Date(2020, 0, 1); // Far back date
        description = 'All time';
    }

    const endDate = now;

    // Build date filter
    const dateFilter = timeframe === 'all' ? {} : {
      date: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Get basic statistics
    const [totalStats, activityBreakdown, sexActivities, recentActivities] = await Promise.all([
      // Total statistics
      Activity.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalActivities: { $sum: 1 },
            totalHours: { $sum: { $ifNull: ['$hours', 0] } },
            avgHours: { $avg: { $ifNull: ['$hours', 0] } }
          }
        }
      ]),

      // Activity breakdown
      Activity.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: '$activity.type',
            count: { $sum: 1 },
            totalHours: { $sum: { $ifNull: ['$hours', 0] } }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Sex activity days
      Activity.aggregate([
        { 
          $match: { 
            ...dateFilter,
            'activity.type': 'sex' 
          } 
        },
        {
          $group: {
            _id: {
              year: { $year: '$date' },
              month: { $month: '$date' },
              day: { $dayOfMonth: '$date' }
            }
          }
        },
        { $count: 'uniqueDays' }
      ]),

      // Recent activities for trends
      Activity.find(dateFilter)
        .sort({ date: -1 })
        .limit(100)
        .select('date hours activity.type')
    ]);    // Calculate basic stats
    const totalActivities = totalStats[0]?.totalActivities || 0;
    const totalHours = totalStats[0]?.totalHours || 0;
    const sexActivityDays = sexActivities[0]?.uniqueDays || 0;

    // Calculate average hours per day
    const timeDiffMs = endDate.getTime() - startDate.getTime();
    const daysDiff = Math.max(1, Math.ceil(timeDiffMs / (1000 * 60 * 60 * 24)));
    const avgHoursPerDay = totalHours / daysDiff;

    // Calculate this month's activities
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthActivities = await Activity.countDocuments({
      date: { $gte: thisMonthStart, $lte: now }
    });

    // Process activity breakdown with percentages
    const processedBreakdown = activityBreakdown.map(item => ({
      type: item._id,
      count: item.count,
      totalHours: item.totalHours,
      percentage: totalActivities > 0 ? Math.round((item.count / totalActivities) * 100) : 0
    }));

    // Find most frequent activity
    const mostFrequentActivity = processedBreakdown[0] || { type: 'none', count: 0 };

    // Calculate recent trends
    const lastWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [lastWeekStats, lastMonthStats] = await Promise.all([
      Activity.aggregate([
        { $match: { date: { $gte: lastWeekStart, $lte: now } } },
        {
          $group: {
            _id: null,
            totalHours: { $sum: { $ifNull: ['$hours', 0] } },
            count: { $sum: 1 }
          }
        }
      ]),
      Activity.aggregate([
        { $match: { date: { $gte: lastMonthStart, $lte: now } } },
        {
          $group: {
            _id: null,
            totalHours: { $sum: { $ifNull: ['$hours', 0] } },
            count: { $sum: 1 }
          }
        }
      ])
    ]);    const lastWeekHours = lastWeekStats[0]?.totalHours || 0;
    const lastMonthHours = lastMonthStats[0]?.totalHours || 0;
    const weeklyAverage = lastWeekHours / 7;
    const monthlyAverage = lastMonthHours / 30;

    // Calculate days together since relationship start (January 25, 2024)
    const relationshipStartDate = new Date('2024-01-25');
    const daysTogether = Math.floor((now.getTime() - relationshipStartDate.getTime()) / (1000 * 60 * 60 * 24));    return {
      totalHoursTogether: Math.round(totalHours * 100) / 100,
      sexActivityDays,
      totalActivities,
      activitiesThisMonth: thisMonthActivities,
      avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
      daysTogether,
      mostFrequentActivity: {
        type: mostFrequentActivity.type,
        count: mostFrequentActivity.count
      },
      activityBreakdown: processedBreakdown,
      recentTrends: {
        weeklyAverage: Math.round(weeklyAverage * 100) / 100,
        monthlyAverage: Math.round(monthlyAverage * 100) / 100,
        lastWeekHours: Math.round(lastWeekHours * 100) / 100,
        lastMonthHours: Math.round(lastMonthHours * 100) / 100
      },
      timeframe: {
        startDate,
        endDate,
        description
      }
    };
  } catch (error: any) {
    console.error('Error calculating relationship statistics:', error);
    throw new Error(`Failed to calculate statistics: ${error.message}`);
  }
};

export const getMonthlyHours = async (year?: number): Promise<MonthlyHoursData[]> => {
  try {
    // Build query conditions
    const conditions: any = {};
    
    if (year) {
      conditions.date = {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      };
    }

    // Get all activities
    const activities = await Activity.find(conditions).sort({ date: 1 });

    // Group by year-month
    const monthlyData = new Map<string, { hours: number; activities: number }>();

    activities.forEach(activity => {
      const date = new Date(activity.date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { hours: 0, activities: 0 });
      }
        const data = monthlyData.get(monthKey)!;
      data.hours += activity.hours || 0;
      data.activities += 1;
    });

    // Convert to array format
    const result: MonthlyHoursData[] = [];
    
    for (const [monthKey, data] of monthlyData.entries()) {
      const [yearStr, monthStr] = monthKey.split('-');
      result.push({
        month: monthStr,
        year: parseInt(yearStr),
        hours: Math.round(data.hours * 100) / 100, // Round to 2 decimal places
        activities: data.activities
      });
    }

    // Sort by year and month
    result.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return parseInt(a.month) - parseInt(b.month);
    });

    return result;
  } catch (error) {
    console.error('Error calculating monthly hours:', error);
    throw new Error('Failed to calculate monthly hours statistics');
  }
};
