jest.mock('../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn()
  }
}));

import { Activity } from '../models/Activity';
import {
  getRelationshipStatistics,
  getMonthlyHours,
  getMonthlyStatistics,
  getMonthlyActivityBreakdown,
  getWeeklyHeatmapData,
  getCumulativeTimelineData,
  getStreakStatistics,
  getMilestones,
  getTrends
} from './statistics.service';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;
const mockedFind = Activity.find as unknown as jest.Mock;
const mockedFindOne = Activity.findOne as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
  mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
  mockedFindOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }) });
});

describe('getRelationshipStatistics', () => {
  it.each(['week', 'month', 'quarter', 'year', 'all', 'unknown'])(
    'computes a startDate for timeframe=%s without throwing',
    async (timeframe) => {
      await expect(getRelationshipStatistics(timeframe, { userId: 'u1' })).resolves.toBeDefined();
    }
  );

  it('scopes to a specific group when groupId is provided', async () => {
    await getRelationshipStatistics('all', { userId: 'u1', groupId: 'g1' });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('scopes to personal-only items when personalOnly is set', async () => {
    await getRelationshipStatistics('all', { userId: 'u1', personalOnly: true });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ userId: 'u1' }) }])
    );
  });

  it('falls back to buildAccessQuery when neither groupId nor personalOnly is set', async () => {
    await getRelationshipStatistics('all', { userId: 'u1', userGroupIds: ['g1'] });
    expect(mockedAggregate).toHaveBeenCalled();
  });

  it('maps per-type stats and computes totals, firstEntryDate, and daysSinceFirstEntry', async () => {
    mockedAggregate.mockResolvedValue([
      {
        _id: 'type-1',
        slug: 'reading',
        name: 'Reading',
        color: '#fff',
        valueType: 'hours',
        count: 3,
        totalHours: 4.555,
        uniqueDays: ['2026-01-01', '2026-01-02']
      }
    ]);
    mockedFindOne.mockReturnValue({
      sort: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue({ date: new Date('2026-01-01') }) })
    });

    const result = await getRelationshipStatistics('all', { userId: 'u1' });

    expect(result.types[0]).toMatchObject({ typeId: 'type-1', slug: 'reading', count: 3, totalHours: 4.56, uniqueDays: 2 });
    expect(result.totalActivities).toBe(3);
    expect(result.firstEntryDate).toBe('2026-01-01');
    expect(result.daysSinceFirstEntry).toBeGreaterThanOrEqual(0);
  });

  it('returns firstEntryDate null and daysSinceFirstEntry 0 when there is no first entry', async () => {
    const result = await getRelationshipStatistics('all', { userId: 'u1' });
    expect(result.firstEntryDate).toBeNull();
    expect(result.daysSinceFirstEntry).toBe(0);
  });
});

describe('getStreakStatistics', () => {
  const NOW = new Date('2026-03-10T09:30:00.000Z');

  /** The two aggregations run in order: distinct logged days, then per-type rows. */
  function mockStreakAggregations(days: string[], types: unknown[] = []) {
    mockedAggregate
      .mockResolvedValueOnce(days.map((d) => ({ _id: d })))
      .mockResolvedValueOnce(types);
  }

  function typeRow(overrides: Record<string, unknown> = {}) {
    return {
      _id: 'type-1',
      slug: 'date-night',
      name: 'Date night',
      color: '#ff0000',
      firstDate: new Date('2026-01-01'),
      lastDate: new Date('2026-02-04'),
      loggedDays: ['2026-01-01', '2026-01-15', '2026-02-04'],
      ...overrides
    };
  }

  it('returns empty streaks when nothing has been logged', async () => {
    mockStreakAggregations([]);
    const result = await getStreakStatistics({ userId: 'u1' }, NOW);
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      longestStreakStart: null,
      longestStreakEnd: null,
      totalLoggedDays: 0,
      lastEntryDate: null,
      daysSinceLastEntry: null,
      types: []
    });
  });

  it('excludes future-dated entries so a planned day cannot claim a streak', async () => {
    mockStreakAggregations([]);
    await getStreakStatistics({ userId: 'u1' }, NOW);
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $match: expect.objectContaining({ date: { $lt: new Date('2026-03-11T00:00:00.000Z') } }) }
      ])
    );
  });

  it('scopes to a group when groupId is provided', async () => {
    mockStreakAggregations([]);
    await getStreakStatistics({ userId: 'u1', groupId: 'g1' }, NOW);
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('counts a run ending today as the current streak and reports the longest run', async () => {
    mockStreakAggregations([
      '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', // longest: 4
      '2026-03-08', '2026-03-09', '2026-03-10' // current: 3, ends today
    ]);

    const result = await getStreakStatistics({ userId: 'u1' }, NOW);

    expect(result).toMatchObject({
      currentStreak: 3,
      longestStreak: 4,
      longestStreakStart: '2026-01-01',
      longestStreakEnd: '2026-01-04',
      totalLoggedDays: 7,
      lastEntryDate: '2026-03-10',
      daysSinceLastEntry: 0
    });
  });

  it('keeps the streak alive on a day that has not been logged yet', async () => {
    mockStreakAggregations(['2026-03-08', '2026-03-09']);
    const result = await getStreakStatistics({ userId: 'u1' }, NOW);
    expect(result).toMatchObject({ currentStreak: 2, daysSinceLastEntry: 1 });
  });

  it('breaks the streak once two days have passed', async () => {
    mockStreakAggregations(['2026-03-07', '2026-03-08']);
    const result = await getStreakStatistics({ userId: 'u1' }, NOW);
    expect(result).toMatchObject({ currentStreak: 0, longestStreak: 2, daysSinceLastEntry: 2 });
  });

  it('derives a type cadence from its distinct logged days and how overdue it is', async () => {
    mockStreakAggregations([], [typeRow()]);

    const [type] = (await getStreakStatistics({ userId: 'u1' }, NOW)).types;

    expect(type).toEqual({
      typeId: 'type-1',
      slug: 'date-night',
      name: 'Date night',
      color: '#ff0000',
      lastDate: '2026-02-04',
      daysSince: 34,
      loggedDays: 3,
      // 34 days spanned over 3 logged days => a gap of 17
      typicalGapDays: 17,
      overdueRatio: 2
    });
  });

  it('leaves the cadence unknown for a type logged on only one day', async () => {
    mockStreakAggregations([], [
      typeRow({ firstDate: new Date('2026-02-04'), loggedDays: ['2026-02-04'] })
    ]);

    const [type] = (await getStreakStatistics({ userId: 'u1' }, NOW)).types;

    expect(type).toMatchObject({ loggedDays: 1, typicalGapDays: null, overdueRatio: null });
  });

  it('leaves the cadence unknown for several entries on a single day', async () => {
    mockStreakAggregations([], [
      typeRow({ firstDate: new Date('2026-02-04'), loggedDays: ['2026-02-04', '2026-02-04'] })
    ]);

    const [type] = (await getStreakStatistics({ userId: 'u1' }, NOW)).types;

    // $addToSet cannot actually return a duplicate — this guards the divide-by-zero
    // path that a zero-length span would otherwise open.
    expect(type).toMatchObject({ typicalGapDays: 0, overdueRatio: null });
  });

  it('sorts by how overdue each type is, with unknown cadences last', async () => {
    const oneOff = (slug: string, day: string) =>
      typeRow({ _id: slug, slug, firstDate: new Date(day), lastDate: new Date(day), loggedDays: [day] });

    mockStreakAggregations([], [
      // no rhythm at all — these sort last, oldest first, whichever order they arrive in
      oneOff('once-recent', '2026-03-01'),
      // due exactly now: 34 days since, on a 34-day cadence
      typeRow({ _id: 'due', slug: 'due', loggedDays: ['2026-01-01', '2026-02-04'] }),
      // 2x overdue
      typeRow({ _id: 'overdue', slug: 'overdue' }),
      oneOff('once-old', '2026-01-05')
    ]);

    const result = await getStreakStatistics({ userId: 'u1' }, NOW);

    expect(result.types.map((t) => t.slug)).toEqual(['overdue', 'due', 'once-old', 'once-recent']);
  });
});

describe('getMonthlyHours', () => {
  function chainableFind(result: any[]) {
    return { sort: jest.fn().mockResolvedValue(result) };
  }

  it('filters by year when provided', async () => {
    mockedFind.mockReturnValue(chainableFind([]));
    await getMonthlyHours(2026, { userId: 'u1' });
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ date: expect.any(Object) }));
  });

  it('scopes to a group when groupId is provided', async () => {
    mockedFind.mockReturnValue(chainableFind([]));
    await getMonthlyHours(undefined, { groupId: 'g1' });
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' }));
  });

  it('scopes to personal items when personalOnly is set', async () => {
    mockedFind.mockReturnValue(chainableFind([]));
    await getMonthlyHours(undefined, { userId: 'u1', personalOnly: true });
    expect(mockedFind).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
  });

  it('applies buildAccessQuery when only userId is given', async () => {
    mockedFind.mockReturnValue(chainableFind([]));
    await getMonthlyHours(undefined, { userId: 'u1' });
    expect(mockedFind).toHaveBeenCalled();
  });

  it('leaves conditions empty when no filters are given at all', async () => {
    mockedFind.mockReturnValue(chainableFind([]));
    await getMonthlyHours();
    expect(mockedFind).toHaveBeenCalledWith({});
  });

  it('groups activities by year-month, sums hours, and sorts chronologically', async () => {
    mockedFind.mockReturnValue(
      chainableFind([
        { date: new Date('2026-02-01'), hours: 2 },
        { date: new Date('2026-01-01'), hours: 1.5 },
        { date: new Date('2026-01-15'), hours: 2.111 }
      ])
    );

    const result = await getMonthlyHours(undefined, { userId: 'u1' });

    expect(result).toEqual([
      { month: '01', year: 2026, hours: 3.61, activities: 2 },
      { month: '02', year: 2026, hours: 2, activities: 1 }
    ]);
  });

  it('treats a missing hours field as 0', async () => {
    mockedFind.mockReturnValue(chainableFind([{ date: new Date('2026-01-01'), hours: undefined }]));
    const result = await getMonthlyHours(undefined, { userId: 'u1' });
    expect(result[0].hours).toBe(0);
  });
});

describe('getMonthlyStatistics', () => {
  it('scopes to a group when groupId is provided', async () => {
    await getMonthlyStatistics(2026, { groupId: 'g1' });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('scopes to personal items when personalOnly is set', async () => {
    await getMonthlyStatistics(undefined, { userId: 'u1', personalOnly: true });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ userId: 'u1' }) }])
    );
  });

  it('applies buildAccessQuery when only userId is given', async () => {
    await getMonthlyStatistics(undefined, { userId: 'u1' });
    expect(mockedAggregate).toHaveBeenCalled();
  });

  it('transforms the aggregation result into month/type breakdowns with a true union of days-with-entries', async () => {
    mockedAggregate.mockResolvedValue([
      {
        _id: { year: 2026, month: 3 },
        activities: [
          { type: 'reading', count: 2, dates: ['2026-03-01', '2026-03-02'] },
          { type: 'gym', count: 1, dates: ['2026-03-02'] }
        ]
      }
    ]);

    const result = await getMonthlyStatistics(2026, { userId: 'u1' });

    expect(result[0]).toMatchObject({
      month: '03',
      year: 2026,
      totalDays: 31,
      daysWithEntries: 2,
      types: [
        { slug: 'reading', count: 2, uniqueDays: 2 },
        { slug: 'gym', count: 1, uniqueDays: 1 }
      ]
    });
  });
});

describe('getMonthlyActivityBreakdown', () => {
  it('scopes to a group when groupId is provided', async () => {
    await getMonthlyActivityBreakdown(2026, { groupId: 'g1' });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('scopes to personal items when personalOnly is set', async () => {
    await getMonthlyActivityBreakdown(undefined, { userId: 'u1', personalOnly: true });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ userId: 'u1' }) }])
    );
  });

  it('applies buildAccessQuery when only userId is given', async () => {
    await getMonthlyActivityBreakdown(undefined, { userId: 'u1' });
    expect(mockedAggregate).toHaveBeenCalled();
  });

  it('transforms the aggregation result into a per-type activities map', async () => {
    mockedAggregate.mockResolvedValue([
      {
        _id: { year: 2026, month: 3 },
        activities: [{ type: 'reading', count: 2, hours: 3 }],
        totalActivities: 2,
        totalHours: 3
      }
    ]);

    const result = await getMonthlyActivityBreakdown(2026, { userId: 'u1' });

    expect(result[0]).toMatchObject({
      month: '03',
      year: 2026,
      activities: { reading: { count: 2, hours: 3 } },
      totalHours: 3,
      totalActivities: 2
    });
  });

  it('defaults totalHours/totalActivities to 0 when absent from the aggregation result', async () => {
    mockedAggregate.mockResolvedValue([{ _id: { year: 2026, month: 1 }, activities: [] }]);
    const result = await getMonthlyActivityBreakdown(2026, { userId: 'u1' });
    expect(result[0]).toMatchObject({ totalHours: 0, totalActivities: 0 });
  });
});

describe('getWeeklyHeatmapData', () => {
  it('scopes to a group when groupId is provided', async () => {
    await getWeeklyHeatmapData(2026, { groupId: 'g1' });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('scopes to personal items when personalOnly is set', async () => {
    await getWeeklyHeatmapData(undefined, { userId: 'u1', personalOnly: true });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ userId: 'u1' }) }])
    );
  });

  it('applies buildAccessQuery when only userId is given', async () => {
    await getWeeklyHeatmapData(undefined, { userId: 'u1' });
    expect(mockedAggregate).toHaveBeenCalled();
  });

  it('transforms the aggregation result, converting Mongo dayOfWeek (1-7) to 0-6', async () => {
    mockedAggregate.mockResolvedValue([
      {
        _id: { date: '2026-03-01', year: 2026, month: 3, dayOfWeek: 1, week: 9 },
        activities: [
          { type: 'reading', hours: 1 },
          { type: 'reading', hours: 0.5 }
        ],
        totalActivities: 2,
        totalHours: 1.5
      }
    ]);

    const result = await getWeeklyHeatmapData(2026, { userId: 'u1' });

    expect(result[0]).toMatchObject({
      date: '2026-03-01',
      dayOfWeek: 0,
      week: 9,
      totalActivities: 2,
      totalHours: 1.5,
      activities: { reading: { count: 2, hours: 1.5 } }
    });
  });

  it('treats a missing hours field on an activity entry as 0', async () => {
    mockedAggregate.mockResolvedValue([
      {
        _id: { date: '2026-03-01', year: 2026, month: 3, dayOfWeek: 1, week: 9 },
        activities: [{ type: 'reading', hours: undefined }]
      }
    ]);
    const result = await getWeeklyHeatmapData(2026, { userId: 'u1' });
    expect(result[0].activities.reading.hours).toBe(0);
  });
});

describe('getCumulativeTimelineData', () => {
  it('scopes to a group when groupId is provided', async () => {
    await getCumulativeTimelineData(2026, { groupId: 'g1' });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('scopes to personal items when personalOnly is set', async () => {
    await getCumulativeTimelineData(undefined, { userId: 'u1', personalOnly: true });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ userId: 'u1' }) }])
    );
  });

  it('applies buildAccessQuery when only userId is given, and returns [] when there is no data and no year', async () => {
    const result = await getCumulativeTimelineData(undefined, { userId: 'u1' });
    expect(result).toEqual([]);
  });

  it('derives the date range from the data when no year is given', async () => {
    mockedAggregate.mockResolvedValue([
      { _id: '2026-01-02', activities: [{ type: 'reading', count: 1, hours: 1 }], dailyActivities: 1, dailyHours: 1 },
      { _id: '2026-01-01', activities: [{ type: 'reading', count: 1, hours: 1 }], dailyActivities: 1, dailyHours: 1 }
    ]);

    const result = await getCumulativeTimelineData(undefined, { userId: 'u1' });

    expect(result[0].date).toBe('2026-01-01');
    expect(result[result.length - 1].date).toBe('2026-01-02');
  });

  it('fills in missing dates within a year range and accumulates running totals', async () => {
    mockedAggregate.mockResolvedValue([
      { _id: '2026-01-01', activities: [{ type: 'reading', count: 2, hours: 3 }], dailyActivities: 2, dailyHours: 3 }
    ]);

    const result = await getCumulativeTimelineData(2026, { userId: 'u1' });

    // The service builds the range in UTC through `new Date(year + 1, 0, 1)`
    // inclusive, matching the UTC day keys the aggregation groups by — so these
    // boundaries are the same on every host regardless of timezone.
    const firstDate = '2026-01-01';
    const secondDate = '2026-01-02';
    const lastDate = '2027-01-01';

    expect(result.length).toBe(366);
    expect(result[365]).toMatchObject({ date: lastDate, dailyActivities: 0, cumulativeActivities: 2 });
    expect(result[0]).toMatchObject({
      date: firstDate,
      dailyActivities: 2,
      cumulativeActivities: 2,
      dailyHours: 3,
      cumulativeHours: 3,
      activityBreakdown: { reading: { dailyCount: 2, cumulativeCount: 2 } }
    });
    // A day with no data keeps the running cumulative totals but zero daily counts.
    expect(result[1]).toMatchObject({
      date: secondDate,
      dailyActivities: 0,
      cumulativeActivities: 2,
      dailyHours: 0,
      cumulativeHours: 3
    });
  });
});

describe('getMilestones', () => {
  const NOW = new Date('2026-03-10T09:30:00.000Z');
  const day = (key: string) => new Date(`${key}T00:00:00.000Z`);

  /** The two aggregations run in order: per-type totals, then the recent entries. */
  function mockMilestoneAggregations(types: unknown[], recent: unknown[] = []) {
    mockedAggregate.mockResolvedValueOnce(types).mockResolvedValueOnce(recent);
  }

  function totalsRow(overrides: Record<string, unknown> = {}) {
    return {
      _id: 'type-1',
      name: 'Dinner',
      color: '#ff0000',
      count: 10,
      firstDate: day('2025-03-10'),
      lastDate: day('2026-03-09'),
      ...overrides
    };
  }

  it('returns nothing to celebrate when nothing has been logged', async () => {
    mockMilestoneAggregations([]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW });
    expect(result).toEqual({ since: null, daysTogether: null, recent: [], upcoming: [] });
  });

  it('excludes future-dated entries so a planned day cannot award a milestone early', async () => {
    mockMilestoneAggregations([]);
    await getMilestones({ userId: 'u1' }, { now: NOW });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $match: expect.objectContaining({ date: { $lt: new Date('2026-03-11T00:00:00.000Z') } }) }
      ])
    );
  });

  it('scopes to a group when groupId is provided', async () => {
    mockMilestoneAggregations([]);
    await getMilestones({ userId: 'u1', groupId: 'g1' }, { now: NOW });
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('counts days together from the configured start date', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, startDate: '2024-10-27' });
    expect(result.since).toBe('2024-10-27');
    expect(result.daysTogether).toBe(499);
  });

  it('falls back to the first entry when no start date is configured', async () => {
    mockMilestoneAggregations([
      totalsRow({ firstDate: day('2025-03-10') }),
      totalsRow({ _id: 'type-2', firstDate: day('2024-12-25') })
    ]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW });
    expect(result.since).toBe('2024-12-25');
  });

  it('reports a start date in the future as nothing counted yet', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, startDate: '2026-06-01' });
    expect(result.daysTogether).toBeNull();
    expect(result.upcoming.some((m) => m.kind === 'days-together')).toBe(false);
  });

  it('dates the next days-together milestone exactly', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, startDate: '2024-10-27' });
    expect(result.upcoming).toContainEqual(
      expect.objectContaining({
        kind: 'days-together',
        target: 500,
        label: '500 days together',
        expectedOn: '2026-03-11',
        daysAway: 1
      })
    );
  });

  it('reports a days-together milestone reached inside the lookback window', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, startDate: '2025-04-05' });
    // 339 days together: the 300-day mark fell 39 days ago.
    expect(result.recent).toContainEqual(
      expect.objectContaining({ kind: 'days-together', target: 300, daysAgo: 39 })
    );
  });

  it('drops a days-together milestone reached before the lookback window', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, startDate: '2025-01-01', recentDays: 30 });
    expect(result.recent.some((m) => m.kind === 'days-together')).toBe(false);
  });

  it('puts the next anniversary on the calendar day, not 365 days out', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, startDate: '2024-06-01' });
    expect(result.upcoming).toContainEqual(
      expect.objectContaining({
        kind: 'anniversary',
        target: 2,
        label: '2 years together',
        expectedOn: '2026-06-01'
      })
    );
  });

  it('uses the singular for a first anniversary', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, startDate: '2025-06-01' });
    expect(result.upcoming).toContainEqual(
      expect.objectContaining({ kind: 'anniversary', target: 1, label: '1 year together' })
    );
  });

  it('projects the next per-type count milestone at the pace it is logged', async () => {
    // 10 dinners over 365 days: 15 more is roughly 15 × 36.5 days away, past the horizon.
    mockMilestoneAggregations([totalsRow()]);
    const withinReach = await getMilestones({ userId: 'u1' }, { now: NOW, horizonDays: 600 });
    expect(withinReach.upcoming).toContainEqual(
      expect.objectContaining({
        kind: 'type-count',
        typeId: 'type-1',
        target: 25,
        label: '25 × Dinner',
        remaining: 15,
        projected: true,
        daysAway: 548
      })
    );

    mockMilestoneAggregations([totalsRow()]);
    const beyondHorizon = await getMilestones({ userId: 'u1' }, { now: NOW, horizonDays: 180 });
    expect(beyondHorizon.upcoming.some((m) => m.kind === 'type-count')).toBe(false);
  });

  it('dates a count milestone crossed inside the window from the entry that crossed it', async () => {
    // 10 entries in total, the last four inside the window: the 10th is the newest.
    mockMilestoneAggregations(
      [totalsRow({ count: 10 })],
      [
        {
          _id: 'type-1',
          dates: [day('2026-02-01'), day('2026-02-10'), day('2026-02-20'), day('2026-03-01')]
        }
      ]
    );
    const result = await getMilestones({ userId: 'u1' }, { now: NOW });
    expect(result.recent).toContainEqual(
      expect.objectContaining({
        kind: 'type-count',
        target: 10,
        achievedOn: '2026-03-01',
        daysAgo: 9
      })
    );
  });

  it('does not re-announce a count milestone crossed before the window', async () => {
    // The 10th entry predates the window; only entries 11 and 12 are inside it.
    mockMilestoneAggregations(
      [totalsRow({ count: 12 })],
      [{ _id: 'type-1', dates: [day('2026-02-20'), day('2026-03-01')] }]
    );
    const result = await getMilestones({ userId: 'u1' }, { now: NOW });
    expect(result.recent.some((m) => m.kind === 'type-count')).toBe(false);
  });

  it('ignores hidden types entirely, in their own milestones and in the total', async () => {
    mockMilestoneAggregations([
      totalsRow({ _id: 'type-1', count: 10 }),
      totalsRow({ _id: 'type-2', name: 'Cinema', count: 10 }),
      totalsRow({ _id: 'hidden-1', name: 'Chores', count: 90 })
    ]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, hiddenTypeIds: ['hidden-1'], horizonDays: 3650 });
    expect(result.upcoming.some((m) => m.typeId === 'hidden-1')).toBe(false);
    // The total counts the two visible types only, so its next rung is 25, not 150.
    expect(result.upcoming).toContainEqual(
      expect.objectContaining({ kind: 'total-count', target: 25, label: '25 entries logged' })
    );
  });

  it('skips the combined total when there is only one type to combine', async () => {
    mockMilestoneAggregations([totalsRow()]);
    const result = await getMilestones({ userId: 'u1' }, { now: NOW, horizonDays: 3650 });
    expect(result.upcoming.some((m) => m.kind === 'total-count')).toBe(false);
  });

  it('sorts each list by nearness and caps it at the limit', async () => {
    mockMilestoneAggregations([
      totalsRow({ _id: 'type-1', name: 'Dinner', count: 10 }),
      totalsRow({ _id: 'type-2', name: 'Cinema', count: 24 }),
      totalsRow({ _id: 'type-3', name: 'Hike', count: 49 })
    ]);
    const result = await getMilestones(
      { userId: 'u1' },
      { now: NOW, startDate: '2024-10-27', horizonDays: 3650, limit: 3 }
    );
    expect(result.upcoming).toHaveLength(3);
    const daysAway = result.upcoming.map((m) => m.daysAway!);
    expect([...daysAway].sort((a, b) => a - b)).toEqual(daysAway);
  });
});

describe('getTrends', () => {
  const NOW = new Date('2026-03-10T09:30:00.000Z');

  function row(
    typeId: string,
    window: 'current' | 'previous',
    overrides: Record<string, unknown> = {}
  ) {
    return {
      _id: { typeId, window },
      slug: 'dinner',
      name: 'Dinner',
      color: '#ff0000',
      valueType: 'string',
      entries: 1,
      hours: 0,
      days: ['2026-03-01'],
      ...overrides
    };
  }

  it('returns zeroed totals and no rows when nothing has been logged', async () => {
    mockedAggregate.mockResolvedValue([]);
    const result = await getTrends({ userId: 'u1' }, { now: NOW });

    expect(result.types).toEqual([]);
    expect(result.totals.current).toEqual({ entries: 0, hours: 0, activeDays: 0 });
    expect(result.totals.direction).toBe('flat');
    expect(result.totals.entriesChangePct).toBeNull();
  });

  it('reports both windows as inclusive day bounds that meet without a gap', async () => {
    mockedAggregate.mockResolvedValue([]);
    const result = await getTrends({ userId: 'u1' }, { now: NOW, windowDays: 30 });

    expect(result).toMatchObject({
      windowDays: 30,
      currentStart: '2026-02-09',
      currentEnd: '2026-03-10',
      previousStart: '2026-01-10',
      previousEnd: '2026-02-08'
    });
  });

  it('reads both windows in one query, bounded below by the previous start and above by tomorrow', async () => {
    mockedAggregate.mockResolvedValue([]);
    await getTrends({ userId: 'u1' }, { now: NOW, windowDays: 30 });

    expect(mockedAggregate).toHaveBeenCalledTimes(1);
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: expect.objectContaining({
            date: {
              $gte: new Date('2026-01-10T00:00:00.000Z'),
              $lt: new Date('2026-03-11T00:00:00.000Z')
            }
          })
        }
      ])
    );
  });

  it('scopes to a group when groupId is provided', async () => {
    mockedAggregate.mockResolvedValue([]);
    await getTrends({ userId: 'u1', groupId: 'g1' }, { now: NOW });

    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ groupId: 'g1' }) }])
    );
  });

  it('scopes to personal items when personalOnly is set', async () => {
    mockedAggregate.mockResolvedValue([]);
    await getTrends({ userId: 'u1', personalOnly: true }, { now: NOW });

    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([{ $match: expect.objectContaining({ userId: 'u1' }) }])
    );
  });

  it('pairs a type’s two windows and derives deltas and percent change', async () => {
    mockedAggregate.mockResolvedValue([
      row('t1', 'current', { entries: 9, hours: 12, days: ['2026-03-01', '2026-03-05'] }),
      row('t1', 'previous', { entries: 6, hours: 8, days: ['2026-01-20'] })
    ]);

    const [type] = (await getTrends({ userId: 'u1' }, { now: NOW })).types;

    expect(type).toMatchObject({
      typeId: 't1',
      slug: 'dinner',
      name: 'Dinner',
      color: '#ff0000',
      valueType: 'string',
      current: { entries: 9, hours: 12, activeDays: 2 },
      previous: { entries: 6, hours: 8, activeDays: 1 },
      entriesDelta: 3,
      hoursDelta: 4,
      activeDaysDelta: 1,
      entriesChangePct: 50,
      hoursChangePct: 50,
      direction: 'up'
    });
  });

  it('fills in a zeroed window for a type that only appears in one of them', async () => {
    mockedAggregate.mockResolvedValue([
      row('t1', 'current', { entries: 4 }),
      row('t2', 'previous', { entries: 3, name: 'Walk', slug: 'walk' })
    ]);

    const types = (await getTrends({ userId: 'u1' }, { now: NOW })).types;
    const started = types.find((type) => type.typeId === 't1');
    const stopped = types.find((type) => type.typeId === 't2');

    expect(started).toMatchObject({
      previous: { entries: 0, hours: 0, activeDays: 0 },
      entriesDelta: 4,
      entriesChangePct: null,
      direction: 'new'
    });
    expect(stopped).toMatchObject({
      current: { entries: 0, hours: 0, activeDays: 0 },
      entriesDelta: -3,
      entriesChangePct: -100,
      direction: 'stopped'
    });
  });

  it('calls an unchanged count flat rather than up or down', async () => {
    mockedAggregate.mockResolvedValue([
      row('t1', 'current', { entries: 5 }),
      row('t1', 'previous', { entries: 5 })
    ]);

    const [type] = (await getTrends({ userId: 'u1' }, { now: NOW })).types;
    expect(type).toMatchObject({ entriesDelta: 0, entriesChangePct: 0, direction: 'flat' });
  });

  it('sorts the biggest mover first in either direction', async () => {
    mockedAggregate.mockResolvedValue([
      row('small', 'current', { entries: 3, name: 'Small' }),
      row('small', 'previous', { entries: 2, name: 'Small' }),
      row('dropped', 'current', { entries: 1, name: 'Dropped' }),
      row('dropped', 'previous', { entries: 11, name: 'Dropped' }),
      row('risen', 'current', { entries: 8, name: 'Risen' }),
      row('risen', 'previous', { entries: 2, name: 'Risen' })
    ]);

    const types = (await getTrends({ userId: 'u1' }, { now: NOW })).types;
    expect(types.map((type) => type.typeId)).toEqual(['dropped', 'risen', 'small']);
  });

  it('counts a day shared by two types once in the totals', async () => {
    mockedAggregate.mockResolvedValue([
      row('t1', 'current', { entries: 2, hours: 3, days: ['2026-03-01', '2026-03-02'] }),
      row('t2', 'current', { entries: 1, hours: 4, days: ['2026-03-02'], name: 'Walk' })
    ]);

    const { totals } = await getTrends({ userId: 'u1' }, { now: NOW });
    expect(totals.current).toEqual({ entries: 3, hours: 7, activeDays: 2 });
  });

  it('leaves hidden types out of both the rows and the totals', async () => {
    mockedAggregate.mockResolvedValue([
      row('t1', 'current', { entries: 2, hours: 3, days: ['2026-03-01'] }),
      row('hidden', 'current', { entries: 40, hours: 90, days: ['2026-03-02'], name: 'Hidden' })
    ]);

    const result = await getTrends({ userId: 'u1' }, { now: NOW, hiddenTypeIds: ['hidden'] });

    expect(result.types.map((type) => type.typeId)).toEqual(['t1']);
    expect(result.totals.current).toEqual({ entries: 2, hours: 3, activeDays: 1 });
  });

  it('honours a custom window length', async () => {
    mockedAggregate.mockResolvedValue([]);
    const result = await getTrends({ userId: 'u1' }, { now: NOW, windowDays: 7 });

    expect(result).toMatchObject({
      windowDays: 7,
      currentStart: '2026-03-04',
      currentEnd: '2026-03-10',
      previousStart: '2026-02-25',
      previousEnd: '2026-03-03'
    });
  });
});
