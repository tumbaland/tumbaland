import { Activity } from '../../models/Activity';
import { StatisticsFilters, accessQueryFor, MS_PER_DAY, dayNumber } from './shared';
import { todayIn } from '../../utils/time';

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
  const todayKey = todayIn(now);
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
      loggedDays > 1 ? Math.round(((dayNumber(lastDate) - dayNumber(firstDate)) / (loggedDays - 1)) * 10) / 10 : null;

    return {
      typeId: String(row._id),
      slug: row.slug,
      name: row.name,
      color: row.color,
      lastDate,
      daysSince,
      loggedDays,
      typicalGapDays,
      overdueRatio: typicalGapDays && typicalGapDays > 0 ? Math.round((daysSince / typicalGapDays) * 100) / 100 : null
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
