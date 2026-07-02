import { Activity } from '../models/Activity';
import { buildAccessQuery } from '../utils/permissionUtils';

export interface RelationshipStatistics {
  totalHoursTogether: number;
  sexActivityDays: number;
  totalActivities: number;
  daysTogether: number;
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
  daysTogether: number;
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

export interface CumulativeTimelineData {
  date: string; // YYYY-MM-DD format
  dailyActivities: number;
  cumulativeActivities: number;
  dailyHours: number;
  cumulativeHours: number;
  activityBreakdown: {
    [key: string]: {
      dailyCount: number;
      cumulativeCount: number;
    };
  };
}

export const getRelationshipStatistics = async (
  timeframe: string = 'all',
  filters: any
): Promise<RelationshipStatistics> => {
  try {
    const { userId, userGroupIds = [], groupId, personalOnly } = filters;
    
    // Calculate date range based on timeframe
    const now = new Date();
    let startDate: Date;

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter': {
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      }
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(2020, 0, 1); // Far back date
    }

    const endDate = now;

    // Build access query based on filters
    let accessQuery;
    if (groupId) {
      // Filter by specific group
      accessQuery = { groupId };
    } else if (personalOnly) {
      // Personal context - show only items without groupId (personal items only)
      accessQuery = { 
        userId,
        $or: [
          { groupId: null },
          { groupId: { $exists: false } }
        ]
      };
    } else {
      // Use old behavior for backward compatibility
      accessQuery = buildAccessQuery(userId, userGroupIds, false);
    }

    // Build date filter
    const dateFilter =
      timeframe === 'all'
        ? {}
        : {
            date: {
              $gte: startDate,
              $lte: endDate
            }
          };

    // Combine access query with date filter
    const baseQuery = {
      ...accessQuery,
      ...dateFilter
    };    // Get basic statistics
    const [totalStats, totalHoursStats, sexActivities] = await Promise.all([
      Activity.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: null,
            totalActivities: { $sum: 1 },
            avgHours: { $avg: { $ifNull: ['$hours', 0] } }
          }
        }
      ]),

      // Total hours (including all activities)
      Activity.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: null,
            totalHours: { $sum: { $ifNull: ['$hours', 0] } }
          }
        }
      ]),

      // Sex activity days
      Activity.aggregate([
        { $match: baseQuery },
        {
          $lookup: {
            from: 'activity_types',
            localField: 'activity.typeId',
            foreignField: '_id',
            as: 'activityType'
          }
        },
        { $unwind: '$activityType' },
        {
          $match: {
            'activityType.slug': 'sex'
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
      ])
    ]);

    // Calculate basic stats
    const totalActivities = totalStats[0]?.totalActivities || 0;
    const totalHours = totalHoursStats[0]?.totalHours || 0;
    const sexActivityDays = sexActivities[0]?.uniqueDays || 0;
    // Calculate days together since relationship start (January 25, 2024)
    const relationshipStartDate = new Date('2024-01-25');
    const daysTogether = Math.floor((now.getTime() - relationshipStartDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      totalHoursTogether: Math.round(totalHours * 100) / 100,
      sexActivityDays,
      totalActivities,
      daysTogether
    };
  } catch (error: any) {
    console.error('Error calculating relationship statistics:', error);
    throw new Error(`Failed to calculate statistics: ${error.message}`);
  }
};

export const getMonthlyHours = async (
  year?: number,
  filters: any = {}
): Promise<MonthlyHoursData[]> => {
  try {
    const { userId, userGroupIds = [], groupId, personalOnly } = filters;
    
    // Build query conditions
    const conditions: any = {};

    if (year) {
      conditions.date = {
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1)
      };
    }

    // Add access filtering
    if (groupId) {
      // Filter by specific group
      conditions.groupId = groupId;
    } else if (personalOnly) {
      // Personal context - show only items without groupId (personal items only)
      conditions.userId = userId;
      conditions.$or = [
        { groupId: null },
        { groupId: { $exists: false } }
      ];
    } else if (userId) {
      // Use the old behavior for backward compatibility
      const accessQuery = buildAccessQuery(userId, userGroupIds, false);
      Object.assign(conditions, accessQuery);
    }

    // Get all activities
    const activities = await Activity.find(conditions).sort({ date: 1 });

    // Group by year-month
    const monthlyData = new Map<string, { hours: number; activities: number }>();

    activities.forEach((activity) => {
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

export const getMonthlyStatistics = async (
  year?: number,
  filters: any = {}
): Promise<MonthlyStatisticsData[]> => {
  try {
    const { userId, userGroupIds = [], groupId, personalOnly } = filters;
    
    // Build aggregation pipeline
    const pipeline: any[] = [];
    
    // Build match conditions
    const matchConditions: any = {};

    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      matchConditions.date = {
        $gte: startDate,
        $lt: endDate
      };
    }

    // Add access filtering
    if (groupId) {
      matchConditions.groupId = groupId;
    } else if (personalOnly) {
      matchConditions.userId = userId;
      matchConditions.$or = [
        { groupId: null },
        { groupId: { $exists: false } }
      ];
    } else if (userId) {
      const accessQuery = buildAccessQuery(userId, userGroupIds, false);
      Object.assign(matchConditions, accessQuery);
    }

    pipeline.push({ $match: matchConditions });

    // Lookup activity types
    pipeline.push({
      $lookup: {
        from: 'activity_types',
        localField: 'activity.typeId',
        foreignField: '_id',
        as: 'activityType'
      }
    });

    pipeline.push({
      $unwind: '$activityType'
    });

    // Group by year-month and activity type to count activities
    pipeline.push({
      $group: {
        _id: {
          year: { $year: '$date' },
          month: { $month: '$date' },
          type: '$activityType.slug',
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$date'
            }
          }
        }
      }
    });

    // Group by year-month and type to count all activities and unique days
    pipeline.push({
      $group: {
        _id: {
          year: '$_id.year',
          month: '$_id.month',
          type: '$_id.type'
        },
        count: { $sum: 1 },
        uniqueDays: { $addToSet: '$_id.date' }
      }
    });

    // Group by year-month to aggregate all types
    pipeline.push({
      $group: {
        _id: {
          year: '$_id.year',
          month: '$_id.month'
        },
        activities: {
          $push: {
            type: '$_id.type',
            count: '$count',
            uniqueDays: { $size: '$uniqueDays' }
          }
        }
      }
    });

    pipeline.push({
      $sort: {
        '_id.year': 1,
        '_id.month': 1
      }
    });

    const result = await Activity.aggregate(pipeline);

    // Transform result
    const monthlyStats: MonthlyStatisticsData[] = result.map((item: any) => {
      const year = item._id.year;
      const month = item._id.month;
      const totalDays = new Date(year, month, 0).getDate();

      let sexCount = 0;
      let togetherCount = 0;

      item.activities.forEach((activity: any) => {
        if (activity.type === 'sex') {
          sexCount = activity.count;
        }
        if (activity.type === 'together') {
          togetherCount = activity.count;
        }
      });

      // Calculate unique days met (days with either sex or together)
      // This requires another pass to get unique days across activities
      const daysMet = Math.max(
        item.activities.find((a: any) => a.type === 'sex')?.uniqueDays || 0,
        item.activities.find((a: any) => a.type === 'together')?.uniqueDays || 0
      );

      return {
        month: month.toString().padStart(2, '0'),
        year: year,
        totalDays: totalDays,
        daysMet: daysMet,
        daysWithSex: sexCount,
        daysTogether: togetherCount,
        daysNotMet: totalDays - daysMet
      };
    });

    return monthlyStats;
  } catch (error) {
    console.error('Error calculating monthly statistics:', error);
    throw new Error('Failed to calculate monthly statistics');
  }
};

export const getMonthlyActivityBreakdown = async (
  year?: number,
  filters: any = {}
): Promise<MonthlyActivityData[]> => {
  try {
    const { userId, userGroupIds = [], groupId, personalOnly } = filters;
    
    // Build aggregation pipeline
    const pipeline: any[] = [];

    // Build match conditions
    const matchConditions: any = {};

    // Add year filter if specified
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      matchConditions.date = {
        $gte: startDate,
        $lt: endDate
      };
    }

    // Add access filtering
    if (groupId) {
      matchConditions.groupId = groupId;
    } else if (personalOnly) {
      // Personal context - show only items without groupId (personal items only)
      matchConditions.userId = userId;
      matchConditions.$or = [
        { groupId: null },
        { groupId: { $exists: false } }
      ];
    } else if (userId) {
      // Use the old behavior for backward compatibility
      const accessQuery = buildAccessQuery(userId, userGroupIds, false);
      Object.assign(matchConditions, accessQuery);
    }

    // Add match stage
    pipeline.push({ $match: matchConditions });

    // Add lookup to populate activity types
    pipeline.push({
      $lookup: {
        from: 'activity_types',
        localField: 'activity.typeId',
        foreignField: '_id',
        as: 'activityType'
      }
    });

    // Unwind the activity type
    pipeline.push({
      $unwind: '$activityType'
    });

    // Add grouping stages
    pipeline.push(
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            activityType: '$activityType.slug'
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
    const transformedResult: MonthlyActivityData[] = result.map((item: any) => {
      const activities: { [key: string]: { count: number; hours: number } } = {};

      // Fill in actual data from all activity types
      item.activities.forEach((activity: any) => {
        activities[activity.type] = {
          count: activity.count || 0,
          hours: activity.hours || 0
        };
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

export const getWeeklyHeatmapData = async (
  year?: number,
  filters: any = {}
): Promise<WeeklyHeatmapData[]> => {
  try {
    const { userId, userGroupIds = [], groupId, personalOnly } = filters;
    
    // Build aggregation pipeline
    const pipeline: any[] = [];

    // Build match conditions
    const matchConditions: any = {};

    // Add year filter if specified
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      matchConditions.date = {
        $gte: startDate,
        $lt: endDate
      };
    }

    // Add access filtering
    if (groupId) {
      matchConditions.groupId = groupId;
    } else if (personalOnly) {
      // Personal context - show only items without groupId (personal items only)
      matchConditions.userId = userId;
      matchConditions.$or = [
        { groupId: null },
        { groupId: { $exists: false } }
      ];
    } else if (userId) {
      // Use the old behavior for backward compatibility
      const accessQuery = buildAccessQuery(userId, userGroupIds, false);
      Object.assign(matchConditions, accessQuery);
    }

    // Add match stage
    pipeline.push({ $match: matchConditions });

    // Add lookup to populate activity types
    pipeline.push({
      $lookup: {
        from: 'activity_types',
        localField: 'activity.typeId',
        foreignField: '_id',
        as: 'activityType'
      }
    });

    // Unwind the activity type
    pipeline.push({
      $unwind: '$activityType'
    });

    // Add grouping by date
    pipeline.push(
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date'
              }
            },
            year: { $year: '$date' },
            month: { $month: '$date' },
            dayOfWeek: { $dayOfWeek: '$date' },
            week: { $week: '$date' }
          },
          activities: {
            $push: {
              type: '$activityType.slug',
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
    const transformedResult: WeeklyHeatmapData[] = result.map((item: any) => {
      const activities: { [key: string]: { count: number; hours: number } } = {};

      // Count activities by type (include all types)
      item.activities.forEach((activity: any) => {
        if (!activities[activity.type]) {
          activities[activity.type] = { count: 0, hours: 0 };
        }
        activities[activity.type].count++;
        activities[activity.type].hours += activity.hours || 0;
      });

      // Filter out 'together' for totalActivities
      const filteredActivities = item.activities.filter(
        (activity: any) => activity.type !== 'together'
      );

      return {
        date: item._id.date,
        dayOfWeek: item._id.dayOfWeek - 1, // Convert to 0-6 (Sunday-Saturday)
        week: item._id.week,
        month: item._id.month,
        year: item._id.year,
        totalActivities: filteredActivities.length,
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

export const getCumulativeTimelineData = async (
  year?: number,
  filters: any = {}
): Promise<CumulativeTimelineData[]> => {
  try {
    const { userId, userGroupIds = [], groupId, personalOnly } = filters;
    
    // Build aggregation pipeline
    const pipeline: any[] = [];

    // Build match conditions
    const matchConditions: any = {};

    // Add year filter if specified
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      matchConditions.date = {
        $gte: startDate,
        $lt: endDate
      };
    }

    // Add access filtering
    if (groupId) {
      matchConditions.groupId = groupId;
    } else if (personalOnly) {
      // Personal context - show only items without groupId (personal items only)
      matchConditions.userId = userId;
      matchConditions.$or = [
        { groupId: null },
        { groupId: { $exists: false } }
      ];
    } else if (userId) {
      // Use the old behavior for backward compatibility
      const accessQuery = buildAccessQuery(userId, userGroupIds, false);
      Object.assign(matchConditions, accessQuery);
    }

    // Add match stage
    pipeline.push({ $match: matchConditions });

    // Add lookup to populate activity types
    pipeline.push({
      $lookup: {
        from: 'activity_types',
        localField: 'activity.typeId',
        foreignField: '_id',
        as: 'activityType'
      }
    });

    // Unwind the activity type
    pipeline.push({
      $unwind: '$activityType'
    });

    // Group by date and get daily totals
    pipeline.push(
      {
        $group: {
          _id: {
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$date'
              }
            },
            type: '$activityType.slug'
          },
          count: { $sum: 1 },
          hours: { $sum: '$hours' }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          activities: {
            $push: {
              type: '$_id.type',
              count: '$count',
              hours: '$hours'
            }
          },
          dailyActivities: { $sum: '$count' },
          dailyHours: { $sum: '$hours' }
        }
      },
      {
        $sort: {
          '_id': 1
        }
      }
    );

    const result = await Activity.aggregate(pipeline);

    // Determine date range
    let startDate: Date;
    let endDate: Date;

    if (year) {
      startDate = new Date(year, 0, 1);
      endDate = new Date(year + 1, 0, 1);
    } else {
      // If no year specified, find the actual date range from activities
      if (result.length === 0) {
        return []; // No data
      }
      const dates = result.map(item => new Date(item._id)).sort((a, b) => a.getTime() - b.getTime());
      startDate = dates[0];
      endDate = dates[dates.length - 1];
    }

    // Create a map of activity data by date
    const activityDataByDate = new Map<string, any>();
    result.forEach((item: any) => {
      activityDataByDate.set(item._id, item);
    });

    // Generate all dates in the range and fill missing dates
    const allDates: string[] = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allDates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Transform and calculate cumulative totals
    let cumulativeActivities = 0;
    let cumulativeHours = 0;
    const cumulativeActivityBreakdown: { [key: string]: number } = {};

    const transformedResult: CumulativeTimelineData[] = allDates.map((dateString) => {
      const activityData = activityDataByDate.get(dateString);

      // Count daily activities by type (include all types)
      const dailyActivityBreakdown: { [key: string]: number } = {};

      if (activityData) {
        // Use pre-calculated counts from aggregation
        activityData.activities.forEach((activity: any) => {
          dailyActivityBreakdown[activity.type] = activity.count;
        });

        // Update cumulative totals using pre-calculated values
        cumulativeActivities += activityData.dailyActivities || 0;
        cumulativeHours += activityData.dailyHours || 0;

        // Update cumulative activity breakdown
        Object.keys(dailyActivityBreakdown).forEach((type) => {
          if (!cumulativeActivityBreakdown[type]) {
            cumulativeActivityBreakdown[type] = 0;
          }
          cumulativeActivityBreakdown[type] += dailyActivityBreakdown[type];
        });
      }

      // Build activity breakdown object
      const activityBreakdown: { [key: string]: { dailyCount: number; cumulativeCount: number } } = {};
      Object.keys(cumulativeActivityBreakdown).forEach((type) => {
        activityBreakdown[type] = {
          dailyCount: dailyActivityBreakdown[type] || 0,
          cumulativeCount: cumulativeActivityBreakdown[type]
        };
      });

      return {
        date: dateString,
        dailyActivities: Object.values(dailyActivityBreakdown).reduce((a, b) => a + b, 0),
        cumulativeActivities,
        dailyHours: activityData ? (activityData.dailyHours || 0) : 0,
        cumulativeHours,
        activityBreakdown
      };
    });

    return transformedResult;
  } catch (error) {
    console.error('Error calculating cumulative timeline data:', error);
    throw new Error('Failed to calculate cumulative timeline data');
  }
};
