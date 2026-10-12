import { Activity } from '../../models/Activity';
import { StatisticsFilters, accessQueryFor, MS_PER_DAY, dayNumber, dayKeyOf } from './shared';
import { todayIn } from '../../utils/time';

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
export const getTrends = async (filters: StatisticsFilters, options: TrendOptions = {}): Promise<TrendsResult> => {
  const { windowDays = 30, hiddenTypeIds = [], now = new Date() } = options;

  const today = dayNumber(todayIn(now));
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
