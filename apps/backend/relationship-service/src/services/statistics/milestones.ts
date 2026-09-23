import { Activity } from '../../models/Activity';
import { StatisticsFilters, accessQueryFor, MS_PER_DAY, dayNumber, dayKeyOf, toDayKey } from './shared';

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
const daysLadderStep = (value: number): number => (value < 1000 ? 100 : value < 5000 ? 500 : 1000);

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
  const recentByType = new Map(recentRows.map((row) => [String(row._id), row.dates.map(toDayKey)]));

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
    const allRecentDayKeys = visible.flatMap((row) => recentByType.get(String(row._id)) ?? []).sort();
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
  const firstEntryDay = visible.length ? Math.min(...visible.map((row) => dayNumber(toDayKey(row.firstDate)))) : null;
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
