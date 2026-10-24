import { PipelineStage } from 'mongoose';
import { Activity } from '../../models/Activity';
import { StatisticsFilters, typedActivityStages } from './shared';

interface WeeklyHeatmapAggRow {
  _id: { date: string; year: number; month: number; dayOfWeek: number; week: number };
  activities: { type: string; hours?: number }[];
  totalActivities: number;
  totalHours: number;
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

export const getWeeklyHeatmapData = async (
  year?: number,
  filters: StatisticsFilters = {}
): Promise<WeeklyHeatmapData[]> => {
  const pipeline: PipelineStage[] = typedActivityStages(year, filters);

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
