import { PipelineStage } from 'mongoose';
import { Activity } from '../../models/Activity';
import { ActivityMatchConditions, StatisticsFilters, accessQueryFor } from './shared';

interface CumulativeTimelineAggRow {
  _id: string;
  activities: { type: string; count: number; hours: number }[];
  dailyActivities: number;
  dailyHours: number;
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
        _id: 1
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
    const dates = result.map((item) => new Date(item._id)).sort((a, b) => a.getTime() - b.getTime());
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
      dailyHours: activityData ? activityData.dailyHours || 0 : 0,
      cumulativeHours,
      activityBreakdown
    };
  });

  return transformedResult;
};
