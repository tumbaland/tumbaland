import { Activity } from '../models/Activity';
import { buildAccessQuery } from '../utils/permissionUtils';

export interface TypeStatistics {
  typeId: string;
  slug: string;
  name: string;
  color?: string;
  valueType?: string;
  count: number;
  totalHours: number;
  /** distinct days having at least one entry of this type (within the timeframe) */
  uniqueDays: number;
}

export interface RelationshipStatistics {
  totalHours: number;
  totalActivities: number;
  /** date of the first entry ever logged in this scope (not timeframe-limited) */
  firstEntryDate: string | null;
  daysSinceFirstEntry: number;
  /** per-type breakdown; the dashboard decides which types to feature */
  types: TypeStatistics[];
}

export interface MonthlyHoursData {
  month: string;
  year: number;
  hours: number;
  activities: number;
}

export interface MonthlyTypeStatistics {
  slug: string;
  count: number;
  uniqueDays: number;
}

export interface MonthlyStatisticsData {
  month: string;
  year: number;
  totalDays: number;
  /** distinct days in the month with at least one entry of any type */
  daysWithEntries: number;
  types: MonthlyTypeStatistics[];
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
  };

  const [perTypeStats, firstEntry] = await Promise.all([
    // One row per activity type: count, hours, distinct days
    Activity.aggregate([
      { $match: baseQuery },
      {
        $lookup: {
          from: 'activity_types',
          localField: 'typeId',
          foreignField: '_id',
          as: 'activityType'
        }
      },
      { $unwind: '$activityType' },
      {
        $group: {
          _id: '$activityType._id',
          slug: { $first: '$activityType.slug' },
          name: { $first: '$activityType.name' },
          color: { $first: '$activityType.color' },
          valueType: { $first: '$activityType.valueType' },
          count: { $sum: 1 },
          totalHours: { $sum: { $ifNull: ['$hours', 0] } },
          uniqueDays: {
            $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
          }
        }
      },
      { $sort: { count: -1 as const } }
    ]),

    // First entry ever in this scope, independent of the selected timeframe
    Activity.findOne(accessQuery).sort({ date: 1 }).select('date')
  ]);

  const types: TypeStatistics[] = perTypeStats.map((t: any) => ({
    typeId: String(t._id),
    slug: t.slug,
    name: t.name,
    color: t.color,
    valueType: t.valueType,
    count: t.count,
    totalHours: Math.round(t.totalHours * 100) / 100,
    uniqueDays: t.uniqueDays.length
  }));

  const totalActivities = types.reduce((sum, t) => sum + t.count, 0);
  const totalHours = types.reduce((sum, t) => sum + t.totalHours, 0);

  const firstEntryDate = firstEntry ? new Date(firstEntry.date) : null;
  const daysSinceFirstEntry = firstEntryDate
    ? Math.floor((now.getTime() - firstEntryDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalActivities,
    firstEntryDate: firstEntryDate ? firstEntryDate.toISOString().slice(0, 10) : null,
    daysSinceFirstEntry,
    types
  };
};

export const getMonthlyHours = async (
  year?: number,
  filters: any = {}
): Promise<MonthlyHoursData[]> => {
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
};

export const getMonthlyStatistics = async (
  year?: number,
  filters: any = {}
): Promise<MonthlyStatisticsData[]> => {
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
      localField: 'typeId',
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

  // Group by year-month and type, keeping the distinct dates so the month
  // level can compute "days with any entry" as a true union across types.
  pipeline.push({
    $group: {
      _id: {
        year: '$_id.year',
        month: '$_id.month',
        type: '$_id.type'
      },
      count: { $sum: 1 },
      dates: { $addToSet: '$_id.date' }
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
          dates: '$dates'
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

    const allDates = new Set<string>();
    const types: MonthlyTypeStatistics[] = item.activities.map((activity: any) => {
      for (const date of activity.dates) allDates.add(date);
      return {
        slug: activity.type,
        count: activity.count,
        uniqueDays: activity.dates.length
      };
    });

    return {
      month: month.toString().padStart(2, '0'),
      year,
      totalDays,
      daysWithEntries: allDates.size,
      types
    };
  });

  return monthlyStats;
};

export const getMonthlyActivityBreakdown = async (
  year?: number,
  filters: any = {}
): Promise<MonthlyActivityData[]> => {
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
      localField: 'typeId',
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
};

export const getWeeklyHeatmapData = async (
  year?: number,
  filters: any = {}
): Promise<WeeklyHeatmapData[]> => {
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
      localField: 'typeId',
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

    return {
      date: item._id.date,
      dayOfWeek: item._id.dayOfWeek - 1, // Convert to 0-6 (Sunday-Saturday)
      week: item._id.week,
      month: item._id.month,
      year: item._id.year,
      // all types included; the dashboard applies the user's hidden-type
      // configuration client-side via the per-type breakdown
      totalActivities: item.totalActivities || 0,
      totalHours: item.totalHours || 0,
      activities
    };
  });

  return transformedResult;
};

export const getCumulativeTimelineData = async (
  year?: number,
  filters: any = {}
): Promise<CumulativeTimelineData[]> => {
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
      localField: 'typeId',
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
};
