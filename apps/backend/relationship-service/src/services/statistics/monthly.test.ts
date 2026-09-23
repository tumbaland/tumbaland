jest.mock('../../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn(),
    find: jest.fn()
  }
}));

import { Activity } from '../../models/Activity';
import { getMonthlyHours, getMonthlyStatistics, getMonthlyActivityBreakdown } from './monthly';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;
const mockedFind = Activity.find as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
  mockedFind.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
});

describe('getMonthlyHours', () => {
  function chainableFind(result: unknown[]) {
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
