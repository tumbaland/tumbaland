import { PipelineStage } from 'mongoose';
import { Activity } from '../../models/Activity';
import { StatisticsFilters, matchFor, typedActivityStages } from './shared';

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

export const getMonthlyHours = async (year?: number, filters: StatisticsFilters = {}): Promise<MonthlyHoursData[]> => {
  // Get all activities
  const activities = await Activity.find(matchFor(year, filters)).sort({ date: 1 });

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
  const pipeline: PipelineStage[] = typedActivityStages(year, filters);

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
  const pipeline: PipelineStage[] = typedActivityStages(year, filters);

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
