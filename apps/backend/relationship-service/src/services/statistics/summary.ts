import { Activity } from '../../models/Activity';
import { StatisticsFilters, accessQueryFor, MS_PER_DAY } from './shared';
import { todayIn } from '../../utils/time';

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

export const getRelationshipStatistics = async (
  timeframe: string = 'all',
  filters: StatisticsFilters,
  now: Date = new Date()
): Promise<RelationshipStatistics> => {
  // Calculate date range based on timeframe. 'all' needs no start date — it
  // builds an empty date filter below rather than reaching back to a cutoff.
  //
  // In whole days where the people are, as entries are stored (the UTC
  // midnight of their day). Bounding by the instant `now` left today's entries
  // out until 03:00 in Tallinn, since today's midnight is still ahead of UTC
  // then, and the server's own calendar put the 1st of a month in the last one.
  const today = new Date(`${todayIn(now)}T00:00:00.000Z`);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  let startDate: Date | undefined;

  switch (timeframe) {
    case 'week':
      // today and the six days before it
      startDate = new Date(today.getTime() - 6 * MS_PER_DAY);
      break;
    case 'month':
      startDate = new Date(Date.UTC(year, month, 1));
      break;
    case 'quarter':
      startDate = new Date(Date.UTC(year, Math.floor(month / 3) * 3, 1));
      break;
    case 'year':
      startDate = new Date(Date.UTC(year, 0, 1));
      break;
    default:
      startDate = undefined;
  }

  const endDate = today;

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
    ? Math.floor((today.getTime() - firstEntryDate.getTime()) / MS_PER_DAY)
    : 0;

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    totalActivities,
    firstEntryDate: firstEntryDate ? firstEntryDate.toISOString().slice(0, 10) : null,
    daysSinceFirstEntry,
    types
  };
};
