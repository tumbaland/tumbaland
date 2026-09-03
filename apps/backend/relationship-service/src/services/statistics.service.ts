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

export type MilestoneKind = 'days-together' | 'anniversary' | 'type-count' | 'total-count';

export interface Milestone {
  kind: MilestoneKind;
  /** stable across refreshes (e.g. "type-count:65f…:100"), so it can key a list */
  key: string;
  label: string;
  target: number;
  unit: 'days' | 'years' | 'entries';
  typeId?: string;
  color?: string;
  /** reached milestones: the day it happened, and how long ago that was */
  achievedOn?: string;
  daysAgo?: number;
  /** upcoming count milestones: how many more entries it takes */
  remaining?: number;
  /** upcoming: the exact day for date milestones, the projected day for counts */
  expectedOn?: string;
  daysAway?: number;
  /** true when expectedOn is projected from the current pace rather than certain */
  projected?: boolean;
}

export interface MilestonesResult {
  /** the day the "together" counts run from: the configured start, else the first entry */
  since: string | null;
  daysTogether: number | null;
  /** reached inside the lookback window, most recent first */
  recent: Milestone[];
  /** expected inside the horizon, soonest first */
  upcoming: Milestone[];
}

export interface MilestoneOptions {
  /** YYYY-MM-DD the "together" counts run from; absent falls back to the first entry */
  startDate?: string | null;
  /** types the dashboard hides — they raise no milestones and are left out of the totals */
  hiddenTypeIds?: string[];
  now?: Date;
  /** how far back a reached milestone still reads as news */
  recentDays?: number;
  /** how far ahead an upcoming milestone is worth showing */
  horizonDays?: number;
  /** max rows in each list */
  limit?: number;
}

interface TypeTotalsAggRow {
  _id: unknown;
  name: string;
  color?: string;
  count: number;
  firstDate: Date;
  lastDate: Date;
}

interface RecentEntriesAggRow {
  _id: unknown; // typeId
  dates: Date[]; // ascending — the $sort before the $group is what guarantees it
}

/**
 * Milestone ladders. Both thin out as the numbers grow: a 700th day is worth
 * saying, a 5100th is not, so the step widens instead of flooding the dashboard
 * with round numbers nobody asked for.
 */
const daysLadderStep = (value: number): number =>
  value < 1000 ? 100 : value < 5000 ? 500 : 1000;

const countLadderStep = (value: number): number =>
  value < 10 ? 5 : value < 100 ? 25 : value < 300 ? 50 : value < 1000 ? 100 : 500;

type LadderStep = (value: number) => number;

/** The next rung strictly above `value`. */
function nextMilestone(value: number, step: LadderStep): number {
  const size = step(value);
  return Math.floor(value / size) * size + size;
}

/** The highest rung at or below `value`; null before the first one is reached. */
function lastMilestone(value: number, step: LadderStep): number | null {
  let rung = 0;
  for (;;) {
    const next = nextMilestone(rung, step);
    if (next > value) return rung > 0 ? rung : null;
    rung = next;
  }
}

const dayKeyOf = (dayNum: number): string => new Date(dayNum * MS_PER_DAY).toISOString().slice(0, 10);

const toDayKey = (date: Date): string => new Date(date).toISOString().slice(0, 10);

/**
 * The nth anniversary of `since`, as a day number. Date.UTC normalises the one
 * awkward case for us: a 29 February start lands on 1 March in a common year.
 */
function anniversaryDayNumber(since: string, years: number): number {
  const [year, month, day] = since.split('-').map(Number);
  return Math.floor(Date.UTC(year + years, month - 1, day) / MS_PER_DAY);
}

/** Full years elapsed between `since` and today, counted on the calendar, not on 365.25. */
function fullYearsSince(since: string, today: number): number {
  let years = Math.max(0, Math.floor((today - dayNumber(since)) / 366));
  while (anniversaryDayNumber(since, years + 1) <= today) years++;
  return years;
}

/**
 * Round numbers just passed and just ahead — the forward-looking half of the
 * dashboard's momentum story, where `getStreakStatistics` is the backward one.
 *
 * Two kinds of milestone, and they answer "when?" differently. Date milestones
 * (days together, anniversaries) have an exact day: it is arithmetic on the
 * start date. Count milestones (the 100th dinner) do not — so the projection
 * runs at the pace that type has actually been logged at, entries per day over
 * the span it has been going, and is flagged `projected` so the UI never
 * presents an estimate as a date.
 *
 * Like the streak endpoint this is never timeframe-scoped: a total is a total,
 * and future-dated entries are excluded so a planned date can't award a
 * milestone before it happens.
 */
export const getMilestones = async (
  filters: StatisticsFilters,
  options: MilestoneOptions = {}
): Promise<MilestonesResult> => {
  const {
    startDate = null,
    hiddenTypeIds = [],
    now = new Date(),
    recentDays = 60,
    horizonDays = 180,
    limit = 6
  } = options;

  const today = dayNumber(now.toISOString().slice(0, 10));
  const tomorrow = new Date((today + 1) * MS_PER_DAY);
  const windowStart = new Date((today - recentDays) * MS_PER_DAY);
  const scope = accessQueryFor(filters);
  const hidden = new Set(hiddenTypeIds);

  const [typeRows, recentRows] = await Promise.all([
    // Per type: how many entries ever, and the span they cover
    Activity.aggregate<TypeTotalsAggRow>([
      { $match: { ...scope, date: { $lt: tomorrow } } },
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
          name: { $first: '$activityType.name' },
          color: { $first: '$activityType.color' },
          count: { $sum: 1 },
          firstDate: { $min: '$date' },
          lastDate: { $max: '$date' }
        }
      }
    ]),

    // The individual entries inside the lookback window, oldest first. Counting
    // back from the total through these is what dates a crossing exactly,
    // without reading a whole history that could run to thousands of rows.
    Activity.aggregate<RecentEntriesAggRow>([
      { $match: { ...scope, date: { $gte: windowStart, $lt: tomorrow } } },
      { $sort: { date: 1 as const } },
      { $group: { _id: '$typeId', dates: { $push: '$date' } } }
    ])
  ]);

  const visible = typeRows.filter((row) => !hidden.has(String(row._id)));
  const recentByType = new Map(
    recentRows.map((row) => [String(row._id), row.dates.map(toDayKey)])
  );

  const recent: Milestone[] = [];
  const upcoming: Milestone[] = [];

  interface CountSeries {
    kind: 'type-count' | 'total-count';
    keyPrefix: string;
    label: (target: number) => string;
    count: number;
    firstDay: number;
    lastDay: number;
    /** day keys inside the lookback window, ascending */
    recentDayKeys: string[];
    typeId?: string;
    color?: string;
  }

  const addCountMilestones = (series: CountSeries): void => {
    const { kind, keyPrefix, label, count, firstDay, lastDay, recentDayKeys, typeId, color } = series;
    if (count < 1) return;

    // The rung just crossed is only news if it was crossed inside the window —
    // which is exactly when its ordinal falls among the entries we fetched.
    const reached = lastMilestone(count, countLadderStep);
    const countBeforeWindow = count - recentDayKeys.length;
    if (reached !== null && reached > countBeforeWindow) {
      const achievedOn = recentDayKeys[reached - countBeforeWindow - 1];
      recent.push({
        kind,
        key: `${keyPrefix}:${reached}`,
        label: label(reached),
        target: reached,
        unit: 'entries',
        typeId,
        color,
        achievedOn,
        daysAgo: today - dayNumber(achievedOn)
      });
    }

    const target = nextMilestone(count, countLadderStep);
    const remaining = target - count;
    // Entries per day over the span this series has actually been running, so a
    // type logged twice a year isn't told it's a fortnight from its 50th.
    const perDay = count / (lastDay - firstDay + 1);
    const daysAway = Math.ceil(remaining / perDay);
    if (daysAway <= horizonDays) {
      upcoming.push({
        kind,
        key: `${keyPrefix}:${target}`,
        label: label(target),
        target,
        unit: 'entries',
        typeId,
        color,
        remaining,
        expectedOn: dayKeyOf(today + daysAway),
        daysAway,
        projected: true
      });
    }
  };

  for (const row of visible) {
    const typeId = String(row._id);
    addCountMilestones({
      kind: 'type-count',
      keyPrefix: `type-count:${typeId}`,
      label: (target) => `${target} × ${row.name}`,
      count: row.count,
      firstDay: dayNumber(toDayKey(row.firstDate)),
      lastDay: dayNumber(toDayKey(row.lastDate)),
      recentDayKeys: recentByType.get(typeId) ?? [],
      typeId,
      color: row.color
    });
  }

  const totalCount = visible.reduce((sum, row) => sum + row.count, 0);
  if (visible.length > 1 && totalCount > 0) {
    const allRecentDayKeys = visible
      .flatMap((row) => recentByType.get(String(row._id)) ?? [])
      .sort();
    addCountMilestones({
      kind: 'total-count',
      keyPrefix: 'total-count',
      label: (target) => `${target} entries logged`,
      count: totalCount,
      firstDay: Math.min(...visible.map((row) => dayNumber(toDayKey(row.firstDate)))),
      lastDay: Math.max(...visible.map((row) => dayNumber(toDayKey(row.lastDate)))),
      recentDayKeys: allRecentDayKeys
    });
  }

  // "Together" counts from the configured start date; without one the first
  // entry stands in, the same fallback the days-together stat card uses.
  const firstEntryDay = visible.length
    ? Math.min(...visible.map((row) => dayNumber(toDayKey(row.firstDate))))
    : null;
  const sinceDay = startDate ? dayNumber(startDate) : firstEntryDay;
  const since = sinceDay !== null ? dayKeyOf(sinceDay) : null;
  // A start date in the future has nothing to celebrate yet.
  const daysTogether = sinceDay !== null && sinceDay <= today ? today - sinceDay : null;

  if (since !== null && daysTogether !== null) {
    const reachedDays = lastMilestone(daysTogether, daysLadderStep);
    if (reachedDays !== null && daysTogether - reachedDays <= recentDays) {
      recent.push({
        kind: 'days-together',
        key: `days-together:${reachedDays}`,
        label: `${reachedDays} days together`,
        target: reachedDays,
        unit: 'days',
        achievedOn: dayKeyOf(sinceDay! + reachedDays),
        daysAgo: daysTogether - reachedDays
      });
    }

    const nextDays = nextMilestone(daysTogether, daysLadderStep);
    if (nextDays - daysTogether <= horizonDays) {
      upcoming.push({
        kind: 'days-together',
        key: `days-together:${nextDays}`,
        label: `${nextDays} days together`,
        target: nextDays,
        unit: 'days',
        expectedOn: dayKeyOf(sinceDay! + nextDays),
        daysAway: nextDays - daysTogether
      });
    }

    const yearLabel = (years: number) => `${years} ${years === 1 ? 'year' : 'years'} together`;
    const years = fullYearsSince(since, today);
    if (years >= 1) {
      const achievedOn = anniversaryDayNumber(since, years);
      if (today - achievedOn <= recentDays) {
        recent.push({
          kind: 'anniversary',
          key: `anniversary:${years}`,
          label: yearLabel(years),
          target: years,
          unit: 'years',
          achievedOn: dayKeyOf(achievedOn),
          daysAgo: today - achievedOn
        });
      }
    }

    const nextAnniversary = anniversaryDayNumber(since, years + 1);
    if (nextAnniversary - today <= horizonDays) {
      upcoming.push({
        kind: 'anniversary',
        key: `anniversary:${years + 1}`,
        label: yearLabel(years + 1),
        target: years + 1,
        unit: 'years',
        expectedOn: dayKeyOf(nextAnniversary),
        daysAway: nextAnniversary - today
      });
    }
  }

  recent.sort((a, b) => a.daysAgo! - b.daysAgo! || a.label.localeCompare(b.label));
  upcoming.sort((a, b) => a.daysAway! - b.daysAway! || a.label.localeCompare(b.label));

  return {
    since,
    daysTogether,
    recent: recent.slice(0, limit),
    upcoming: upcoming.slice(0, limit)
  };
};

/** How a window compares to the one before it. */
export type TrendDirection = 'up' | 'down' | 'flat' | 'new' | 'stopped';

export interface TrendTotals {
  entries: number;
  hours: number;
  /** distinct days carrying at least one entry inside the window */
  activeDays: number;
}

export interface TypeTrend {
  typeId: string;
  slug: string;
  name: string;
  color?: string;
  valueType?: string;
  current: TrendTotals;
  previous: TrendTotals;
  entriesDelta: number;
  hoursDelta: number;
  activeDaysDelta: number;
  /** percent change against the previous window; null when there is no baseline to divide by */
  entriesChangePct: number | null;
  hoursChangePct: number | null;
  direction: TrendDirection;
}

export interface TrendsResult {
  windowDays: number;
  /** YYYY-MM-DD bounds, both inclusive */
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  totals: Omit<TypeTrend, 'typeId' | 'slug' | 'name' | 'color' | 'valueType'>;
  /** one row per type logged in either window, biggest mover first */
  types: TypeTrend[];
}

export interface TrendOptions {
  /** length of each of the two windows, in days */
  windowDays?: number;
  /** types the dashboard hides — left out of the rows and of the totals */
  hiddenTypeIds?: string[];
  now?: Date;
}

interface TrendAggRow {
  _id: { typeId: unknown; window: 'current' | 'previous' };
  slug: string;
  name: string;
  color?: string;
  valueType?: string;
  entries: number;
  hours: number;
  days: string[];
}

const EMPTY_TOTALS: TrendTotals = { entries: 0, hours: 0, activeDays: 0 };

/**
 * Percent change, to one decimal. Null when the baseline is zero: "up from
 * nothing" is not a percentage, and `direction` says 'new' for that case
 * instead of handing the UI an infinity to render.
 */
function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function directionOf(current: number, previous: number): TrendDirection {
  if (previous === 0 && current > 0) return 'new';
  if (current === 0 && previous > 0) return 'stopped';
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

/**
 * The last `windowDays` days against the `windowDays` before them — whether
 * each activity type is picking up or fading, per type and overall.
 *
 * The third leg of the dashboard's momentum story: `getStreakStatistics` says
 * what has gone quiet, `getMilestones` says what is worth aiming at, and this
 * says which way things are moving right now. Both windows are read in one
 * aggregation bucketed on the boundary date, so the two halves can never come
 * from different reads of a collection being written to.
 *
 * Future-dated entries are excluded, as everywhere else: a date already in the
 * calendar should not read as a week that went well.
 */
export const getTrends = async (
  filters: StatisticsFilters,
  options: TrendOptions = {}
): Promise<TrendsResult> => {
  const { windowDays = 30, hiddenTypeIds = [], now = new Date() } = options;

  const today = dayNumber(now.toISOString().slice(0, 10));
  // Both windows are `windowDays` long and end the day before the next begins,
  // with the current one ending today inclusive.
  const currentStartDay = today - windowDays + 1;
  const previousStartDay = currentStartDay - windowDays;
  const currentStart = new Date(currentStartDay * MS_PER_DAY);
  const tomorrow = new Date((today + 1) * MS_PER_DAY);

  const rows = await Activity.aggregate<TrendAggRow>([
    {
      $match: {
        ...accessQueryFor(filters),
        date: { $gte: new Date(previousStartDay * MS_PER_DAY), $lt: tomorrow }
      }
    },
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
        _id: {
          typeId: '$activityType._id',
          window: {
            $cond: [{ $gte: ['$date', currentStart] }, 'current', 'previous']
          }
        },
        slug: { $first: '$activityType.slug' },
        name: { $first: '$activityType.name' },
        color: { $first: '$activityType.color' },
        valueType: { $first: '$activityType.valueType' },
        entries: { $sum: 1 },
        hours: { $sum: { $ifNull: ['$hours', 0] } },
        days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$date' } } }
      }
    }
  ]);

  const hidden = new Set(hiddenTypeIds);

  interface TrendAccumulator {
    slug: string;
    name: string;
    color?: string;
    valueType?: string;
    current: TrendTotals;
    previous: TrendTotals;
  }

  const byType = new Map<string, TrendAccumulator>();
  // Active days are counted across types, so a day with a dinner and a walk is
  // one active day in the totals rather than two.
  const totalDays: Record<'current' | 'previous', Set<string>> = {
    current: new Set(),
    previous: new Set()
  };

  for (const row of rows) {
    const typeId = String(row._id.typeId);
    if (hidden.has(typeId)) continue;

    const entry = byType.get(typeId) ?? {
      slug: row.slug,
      name: row.name,
      color: row.color,
      valueType: row.valueType,
      current: { ...EMPTY_TOTALS },
      previous: { ...EMPTY_TOTALS }
    };

    entry[row._id.window] = {
      entries: row.entries,
      hours: row.hours,
      activeDays: row.days.length
    };
    byType.set(typeId, entry);

    for (const day of row.days) totalDays[row._id.window].add(day);
  }

  const types: TypeTrend[] = [...byType].map(([typeId, entry]) => ({
    typeId,
    slug: entry.slug,
    name: entry.name,
    color: entry.color,
    valueType: entry.valueType,
    current: entry.current,
    previous: entry.previous,
    entriesDelta: entry.current.entries - entry.previous.entries,
    hoursDelta: entry.current.hours - entry.previous.hours,
    activeDaysDelta: entry.current.activeDays - entry.previous.activeDays,
    entriesChangePct: changePct(entry.current.entries, entry.previous.entries),
    hoursChangePct: changePct(entry.current.hours, entry.previous.hours),
    direction: directionOf(entry.current.entries, entry.previous.entries)
  }));

  // Biggest mover first, in either direction — a type that fell off is as much
  // news as one that took off. Ties fall back to present volume, then to name
  // so the order is stable across refreshes.
  types.sort(
    (a, b) =>
      Math.abs(b.entriesDelta) - Math.abs(a.entriesDelta) ||
      b.current.entries - a.current.entries ||
      a.name.localeCompare(b.name)
  );

  const sumOf = (window: 'current' | 'previous', field: 'entries' | 'hours'): number =>
    types.reduce((sum, type) => sum + type[window][field], 0);

  const currentTotals: TrendTotals = {
    entries: sumOf('current', 'entries'),
    hours: sumOf('current', 'hours'),
    activeDays: totalDays.current.size
  };
  const previousTotals: TrendTotals = {
    entries: sumOf('previous', 'entries'),
    hours: sumOf('previous', 'hours'),
    activeDays: totalDays.previous.size
  };

  return {
    windowDays,
    currentStart: dayKeyOf(currentStartDay),
    currentEnd: dayKeyOf(today),
    previousStart: dayKeyOf(previousStartDay),
    previousEnd: dayKeyOf(currentStartDay - 1),
    totals: {
      current: currentTotals,
      previous: previousTotals,
      entriesDelta: currentTotals.entries - previousTotals.entries,
      hoursDelta: currentTotals.hours - previousTotals.hours,
      activeDaysDelta: currentTotals.activeDays - previousTotals.activeDays,
      entriesChangePct: changePct(currentTotals.entries, previousTotals.entries),
      hoursChangePct: changePct(currentTotals.hours, previousTotals.hours),
      direction: directionOf(currentTotals.entries, previousTotals.entries)
    },
    types
  };
};
