import { PipelineStage } from 'mongoose';
import { buildAccessQuery } from '@tumbaland/backend-core';
import { Activity } from '../models/Activity';

interface ActivityMatchConditions {
  date?: { $gte?: Date; $lt?: Date };
  groupId?: string | null;
  userId?: string;
  $or?: Record<string, unknown>[];
}

export interface StatisticsFilters {
  userId?: string;
  userGroupIds?: string[];
  groupId?: string;
  personalOnly?: boolean;
}

/**
 * The scope half of a statistics match: one group, one user's non-group entries,
 * or — when neither is asked for — everything the user can reach.
 */
function accessQueryFor(filters: StatisticsFilters): Record<string, unknown> {
  const { userId, userGroupIds = [], groupId, personalOnly } = filters;

  if (groupId) {
    return { groupId };
  }
  if (personalOnly) {
    // Personal context: only entries carrying no group at all.
    return {
      userId,
      $or: [{ groupId: null }, { groupId: { $exists: false } }]
    };
  }
  if (userId) {
    return buildAccessQuery(userId, userGroupIds, false);
  }
  return {};
}

interface PerTypeAggRow {
  _id: unknown;
  slug: string;
  name: string;
  color?: string;
  valueType?: string;
  count: number;
  totalHours: number;
  uniqueDays: string[];
}

interface MonthlyStatsAggRow {
  _id: { year: number; month: number };
  activities: { type: string; count: number; dates: string[] }[];
}

interface MonthlyActivityAggRow {
  _id: { year: number; month: number };
  activities: { type: string; count: number; hours: number }[];
  totalActivities: number;
  totalHours: number;
}

interface WeeklyHeatmapAggRow {
  _id: { date: string; year: number; month: number; dayOfWeek: number; week: number };
  activities: { type: string; hours?: number }[];
  totalActivities: number;
  totalHours: number;
}

interface CumulativeTimelineAggRow {
  _id: string;
  activities: { type: string; count: number; hours: number }[];
  dailyActivities: number;
  dailyHours: number;
}

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
  filters: StatisticsFilters
): Promise<RelationshipStatistics> => {
  // Calculate date range based on timeframe. 'all' needs no start date — it
  // builds an empty date filter below rather than reaching back to a cutoff.
  const now = new Date();
  let startDate: Date | undefined;

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
      startDate = undefined;
  }

  const endDate = now;

  const accessQuery = accessQueryFor(filters);

  // Build date filter
  const dateFilter = startDate
    ? {
        date: {
          $gte: startDate,
          $lte: endDate
        }
      }
    : {};

  // Combine access query with date filter
  const baseQuery = {
    ...accessQuery,
    ...dateFilter
  };

  const [perTypeStats, firstEntry] = await Promise.all([
    // One row per activity type: count, hours, distinct days
    Activity.aggregate<PerTypeAggRow>([
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

  const types: TypeStatistics[] = perTypeStats.map((t) => ({
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days since the epoch for a YYYY-MM-DD key — consecutive days differ by 1. */
function dayNumber(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00.000Z`) / MS_PER_DAY);
}

interface LoggedDayAggRow {
  _id: string; // YYYY-MM-DD
}

interface TypeCadenceAggRow {
  _id: unknown;
  slug: string;
  name: string;
  color?: string;
  firstDate: Date;
  lastDate: Date;
  loggedDays: string[];
}

export interface TypeCadence {
  typeId: string;
  slug: string;
  name: string;
  color?: string;
  /** YYYY-MM-DD of the most recent entry of this type */
  lastDate: string;
  /** whole days between lastDate and today — 0 means logged today */
  daysSince: number;
  /** distinct days this type was ever logged on */
  loggedDays: number;
  /** mean gap between consecutive logged days; null until there are two of them */
  typicalGapDays: number | null;
  /**
   * daysSince measured against this type's own rhythm: 1 means it is exactly due,
   * 3 means three times its usual gap has passed. Null when the cadence is unknown.
   */
  overdueRatio: number | null;
}

export interface StreakStatistics {
  /** consecutive logged days ending today or yesterday; 0 once the chain breaks */
  currentStreak: number;
  longestStreak: number;
  /** YYYY-MM-DD bounds of the longest streak, null when nothing is logged */
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
  /** distinct days with at least one entry, ever */
  totalLoggedDays: number;
  lastEntryDate: string | null;
  /** days since lastEntryDate; null when nothing is logged */
  daysSinceLastEntry: number | null;
  /** one row per type that has ever been logged, most overdue first */
  types: TypeCadence[];
}

/**
 * Logging streaks and per-type staleness — the "you haven't done X in a while"
 * layer of the dashboard.
 *
 * Deliberately not timeframe-scoped the way `getRelationshipStatistics` is:
 * "last time" is only meaningful against the whole history, and a type that has
 * gone quiet would drop out of a windowed query exactly when it matters most.
 * Future-dated entries are excluded so a planned date can't claim a streak or
 * reset a type's staleness before it happens.
 */
export const getStreakStatistics = async (
  filters: StatisticsFilters,
  now: Date = new Date()
): Promise<StreakStatistics> => {
  const todayKey = now.toISOString().slice(0, 10);
  const today = dayNumber(todayKey);
  const tomorrow = new Date((today + 1) * MS_PER_DAY);

  const match = {
    ...accessQueryFor(filters),
    date: { $lt: tomorrow }
  };

  const [loggedDayRows, typeRows] = await Promise.all([
    // Every distinct day with an entry, oldest first
    Activity.aggregate<LoggedDayAggRow>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } } },
      { $sort: { _id: 1 as const } }
    ]),

    // Per type: when it started, when it was last done, and on how many days
    Activity.aggregate<TypeCadenceAggRow>([
      { $match: match },
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
          firstDate: { $min: '$date' },
          lastDate: { $max: '$date' },
          loggedDays: {
            $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }
          }
        }
      }
    ])
  ]);

  const dayKeys = loggedDayRows.map((row) => row._id);
  const dayNumbers = dayKeys.map(dayNumber);

  let currentRun = 0;
  let longestStreak = 0;
  let longestEnd = -1;
  for (let i = 0; i < dayNumbers.length; i++) {
    currentRun = i > 0 && dayNumbers[i] === dayNumbers[i - 1] + 1 ? currentRun + 1 : 1;
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
      longestEnd = i;
    }
  }

  const lastDayNumber = dayNumbers.length ? dayNumbers[dayNumbers.length - 1] : null;
  // A day not yet logged shouldn't read as a broken streak until it's over, so
  // yesterday still counts as current.
  const currentStreak = lastDayNumber !== null && today - lastDayNumber <= 1 ? currentRun : 0;

  const types: TypeCadence[] = typeRows.map((row) => {
    const lastDate = new Date(row.lastDate).toISOString().slice(0, 10);
    const daysSince = Math.max(0, today - dayNumber(lastDate));
    const firstDate = new Date(row.firstDate).toISOString().slice(0, 10);
    const loggedDays = row.loggedDays.length;

    // Mean gap across the span the type has actually been logged over. Uses
    // distinct days rather than entry count so logging the same type twice on
    // one day doesn't read as a tighter rhythm than it is.
    const typicalGapDays =
      loggedDays > 1
        ? Math.round(((dayNumber(lastDate) - dayNumber(firstDate)) / (loggedDays - 1)) * 10) / 10
        : null;

    return {
      typeId: String(row._id),
      slug: row.slug,
      name: row.name,
      color: row.color,
      lastDate,
      daysSince,
      loggedDays,
      typicalGapDays,
      overdueRatio:
        typicalGapDays && typicalGapDays > 0
          ? Math.round((daysSince / typicalGapDays) * 100) / 100
          : null
    };
  });

  // Most overdue first; types with no established rhythm sort last but keep
  // their own staleness order so a long-untouched one-off still surfaces.
  types.sort((a, b) => {
    if (a.overdueRatio !== null && b.overdueRatio !== null) return b.overdueRatio - a.overdueRatio;
    if (a.overdueRatio !== null) return -1;
    if (b.overdueRatio !== null) return 1;
    return b.daysSince - a.daysSince;
  });

  return {
    currentStreak,
    longestStreak,
    longestStreakStart: longestEnd >= 0 ? dayKeys[longestEnd - longestStreak + 1] : null,
    longestStreakEnd: longestEnd >= 0 ? dayKeys[longestEnd] : null,
    totalLoggedDays: dayKeys.length,
    lastEntryDate: dayKeys.length ? dayKeys[dayKeys.length - 1] : null,
    daysSinceLastEntry: lastDayNumber !== null ? today - lastDayNumber : null,
    types
  };
};

export const getMonthlyHours = async (
  year?: number,
  filters: StatisticsFilters = {}
): Promise<MonthlyHoursData[]> => {
  // Build query conditions
  const conditions: ActivityMatchConditions = {};

  if (year) {
    conditions.date = {
      $gte: new Date(year, 0, 1),
      $lt: new Date(year + 1, 0, 1)
    };
  }

  Object.assign(conditions, accessQueryFor(filters));

  // Get all activities
  const activities = await Activity.find(conditions).sort({ date: 1 });

  // Group by year-month
  const monthlyData = new Map<string, { hours: number; activities: number }>();

  activities.forEach((activity) => {
    const date = new Date(activity.date);
    // UTC: entries are stored at UTC midnight, and every other aggregation here
    // buckets with Mongo's `$year`/`$month`, which are UTC too.
    const monthKey = `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, '0')}`;

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
  filters: StatisticsFilters = {}
): Promise<MonthlyStatisticsData[]> => {
  // Build aggregation pipeline
  const pipeline: PipelineStage[] = [];

  // Build match conditions
  const matchConditions: ActivityMatchConditions = {};

  if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    matchConditions.date = {
      $gte: startDate,
      $lt: endDate
    };
  }

  Object.assign(matchConditions, accessQueryFor(filters));

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

  const result = await Activity.aggregate<MonthlyStatsAggRow>(pipeline);

  // Transform result
  const monthlyStats: MonthlyStatisticsData[] = result.map((item) => {
    const year = item._id.year;
    const month = item._id.month;
    const totalDays = new Date(year, month, 0).getDate();

    const allDates = new Set<string>();
    const types: MonthlyTypeStatistics[] = item.activities.map((activity) => {
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
  filters: StatisticsFilters = {}
): Promise<MonthlyActivityData[]> => {
  // Build aggregation pipeline
  const pipeline: PipelineStage[] = [];

  // Build match conditions
  const matchConditions: ActivityMatchConditions = {};

  // Add year filter if specified
  if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    matchConditions.date = {
      $gte: startDate,
      $lt: endDate
    };
  }

  Object.assign(matchConditions, accessQueryFor(filters));

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

  const result = await Activity.aggregate<MonthlyActivityAggRow>(pipeline);

  // Transform the result to match our interface
  const transformedResult: MonthlyActivityData[] = result.map((item) => {
    const activities: { [key: string]: { count: number; hours: number } } = {};

    // Fill in actual data from all activity types
    item.activities.forEach((activity) => {
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
  filters: StatisticsFilters = {}
): Promise<WeeklyHeatmapData[]> => {
  // Build aggregation pipeline
  const pipeline: PipelineStage[] = [];

  // Build match conditions
  const matchConditions: ActivityMatchConditions = {};

  // Add year filter if specified
  if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    matchConditions.date = {
      $gte: startDate,
      $lt: endDate
    };
  }

  Object.assign(matchConditions, accessQueryFor(filters));

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

  const result = await Activity.aggregate<WeeklyHeatmapAggRow>(pipeline);

  // Transform the result to match our interface
  const transformedResult: WeeklyHeatmapData[] = result.map((item) => {
    const activities: { [key: string]: { count: number; hours: number } } = {};

    // Count activities by type (include all types)
    item.activities.forEach((activity) => {
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
  filters: StatisticsFilters = {}
): Promise<CumulativeTimelineData[]> => {
  // Build aggregation pipeline
  const pipeline: PipelineStage[] = [];

  // Build match conditions
  const matchConditions: ActivityMatchConditions = {};

  // Add year filter if specified
  if (year) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    matchConditions.date = {
      $gte: startDate,
      $lt: endDate
    };
  }

  Object.assign(matchConditions, accessQueryFor(filters));

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

  const result = await Activity.aggregate<CumulativeTimelineAggRow>(pipeline);

  // Determine date range
  let startDate: Date;
  let endDate: Date;

  if (year) {
    // UTC, to match the `$dateToString` day keys the aggregation produced and the
    // `toISOString()` formatting below — local midnight would shift the whole
    // series by a day for any host east or west of UTC.
    startDate = new Date(Date.UTC(year, 0, 1));
    endDate = new Date(Date.UTC(year + 1, 0, 1));
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
  const activityDataByDate = new Map<string, CumulativeTimelineAggRow>();
  result.forEach((item) => {
    activityDataByDate.set(item._id, item);
  });

  // Generate all dates in the range and fill missing dates
  const allDates: string[] = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    allDates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
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
      activityData.activities.forEach((activity) => {
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
