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
  getCumulativeTimelineData
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

    // The service builds the range from `new Date(year, 0, 1)` (local time) through
    // `new Date(year + 1, 0, 1)` inclusive, then formats via `.toISOString()`. Derive
    // the same boundary strings here instead of hardcoding UTC dates, so the test
    // doesn't depend on the host's timezone.
    const firstDate = new Date(2026, 0, 1).toISOString().split('T')[0];
    const secondDate = new Date(2026, 0, 2).toISOString().split('T')[0];
    const lastDate = new Date(2027, 0, 1).toISOString().split('T')[0];

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
