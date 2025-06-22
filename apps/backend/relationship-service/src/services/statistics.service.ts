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

export interface MonthlyStatisticsData {
  month: string;
  year: number;
  totalDays: number;
  daysMet: number;
  daysWithSex: number;
  daysNotMet: number;
}

export interface MonthlyActivityData {
  month: string;
  year: number;
  activities: {
    [key: string]: {
      count: number;
      hours: number;
    };
  };
  totalHours: number;
  totalActivities: number;
}

export interface WeeklyHeatmapData {
  date: string; // YYYY-MM-DD format
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  week: number; // Week number in the year
  month: number;
  year: number;
  totalActivities: number;
  totalHours: number;
  activities: {
    [key: string]: {
      count: number;
      hours: number;
    };
  };
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

export const getMonthlyStatistics = async (year?: number): Promise<MonthlyStatisticsData[]> => {
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
    const monthlyData = new Map<string, { daysMet: Set<string>; daysWithSex: Set<string> }>();

    activities.forEach(activity => {
      const date = new Date(activity.date);
      const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { 
          daysMet: new Set<string>(), 
          daysWithSex: new Set<string>() 
        });
      }
      
      const data = monthlyData.get(monthKey)!;
      data.daysMet.add(dateKey);
      
      if (activity.activity.type === 'sex') {
        data.daysWithSex.add(dateKey);
      }
    });

    // Convert to array format with proper calculations
    const result: MonthlyStatisticsData[] = [];
    
    for (const [monthKey, data] of monthlyData.entries()) {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      
      // Calculate total days in month
      const totalDays = new Date(year, month, 0).getDate();
      const daysMet = data.daysMet.size;
      const daysWithSex = data.daysWithSex.size;
      const daysNotMet = totalDays - daysMet;
      
      result.push({
        month: monthStr,
        year: year,
        totalDays: totalDays,
        daysMet: daysMet,
        daysWithSex: daysWithSex,
        daysNotMet: daysNotMet
      });
    }

    // Sort by year and month
    result.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return parseInt(a.month) - parseInt(b.month);
    });

    return result;
  } catch (error) {
    console.error('Error calculating monthly statistics:', error);
    throw new Error('Failed to calculate monthly statistics');
  }
};

export const getMonthlyActivityBreakdown = async (year?: number): Promise<MonthlyActivityData[]> => {
  try {
    // Build aggregation pipeline
    const pipeline: any[] = [];
    
    // Add match stage if year is specified
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      pipeline.push({
        $match: {
          date: {
            $gte: startDate,
            $lt: endDate
          }
        }
      });
    }

    // Add grouping stages
    pipeline.push(
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            activityType: '$activity.type'
          },
          count: { $sum: 1 },
          totalHours: { $sum: '$hours' }
        }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month'
          },
          activities: {
            $push: {
              type: '$_id.activityType',
              count: '$count',
              hours: '$totalHours'
            }
          },
          totalActivities: { $sum: '$count' },
          totalHours: { $sum: '$totalHours' }
        }
      },
      {
        $sort: {
          '_id.year': 1 as const,
          '_id.month': 1 as const
        }
      }
    );

    const result = await Activity.aggregate(pipeline);

    // Transform the result to match our interface
    const transformedResult: MonthlyActivityData[] = result.map(item => {
      const activities: { [key: string]: { count: number; hours: number } } = {};
        // Initialize only the activity types we want to display (excluding together and sex)
      const activityTypes = ['movies', 'cooking', 'dining', 'coffee', 'gaming', 'other'];
      activityTypes.forEach(type => {
        activities[type] = { count: 0, hours: 0 };
      });
        // Fill in actual data (only for allowed activity types)
      item.activities.forEach((activity: any) => {
        if (activities.hasOwnProperty(activity.type)) {
          activities[activity.type] = {
            count: activity.count || 0,
            hours: activity.hours || 0
          };
        }
      });

      return {
        month: item._id.month.toString().padStart(2, '0'),
        year: item._id.year,
        activities,
        totalHours: item.totalHours || 0,
        totalActivities: item.totalActivities || 0
      };
    });

    return transformedResult;
  } catch (error) {
    console.error('Error calculating monthly activity breakdown:', error);
    throw new Error('Failed to calculate monthly activity breakdown');
  }
};

export const getWeeklyHeatmapData = async (year?: number): Promise<WeeklyHeatmapData[]> => {
  try {
    // Build aggregation pipeline
    const pipeline: any[] = [];
    
    // Add match stage if year is specified
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      pipeline.push({
        $match: {
          date: {
            $gte: startDate,
            $lt: endDate
          }
        }
      });
    }

    // Add grouping by date
    pipeline.push(
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$date"
              }
            },
            year: { $year: '$date' },
            month: { $month: '$date' },
            dayOfWeek: { $dayOfWeek: '$date' },
            week: { $week: '$date' }
          },
          activities: {
            $push: {
              type: '$activity.type',
              hours: '$hours'
            }
          },
          totalActivities: { $sum: 1 },
          totalHours: { $sum: '$hours' }
        }
      },
      {
        $sort: {
          '_id.date': 1
        }
      }
    );

    const result = await Activity.aggregate(pipeline);

    // Transform the result to match our interface
    const transformedResult: WeeklyHeatmapData[] = result.map(item => {
      const activities: { [key: string]: { count: number; hours: number } } = {};
      
      // Initialize activity types
      const activityTypes = ['movies', 'cooking', 'dining', 'coffee', 'gaming', 'other'];
      activityTypes.forEach(type => {
        activities[type] = { count: 0, hours: 0 };
      });
      
      // Count activities by type
      item.activities.forEach((activity: any) => {
        if (activities.hasOwnProperty(activity.type)) {
          activities[activity.type].count++;
          activities[activity.type].hours += activity.hours || 0;
        }
      });

      return {
        date: item._id.date,
        dayOfWeek: item._id.dayOfWeek - 1, // Convert to 0-6 (Sunday-Saturday)
        week: item._id.week,
        month: item._id.month,
        year: item._id.year,
        totalActivities: item.totalActivities || 0,
        totalHours: item.totalHours || 0,
        activities
      };
    });

    return transformedResult;
  } catch (error) {
    console.error('Error calculating weekly heatmap data:', error);
    throw new Error('Failed to calculate weekly heatmap data');
  }
};
