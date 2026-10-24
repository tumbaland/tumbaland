jest.mock('../../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn()
  }
}));

import { Activity } from '../../models/Activity';
import { getCumulativeTimelineData } from './timeline';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
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

    // The service builds the range in UTC, from 1 January up to (not including)
    // the next year's, matching the UTC day keys the aggregation groups by — so
    // these boundaries are the same on every host regardless of timezone.
    const firstDate = '2026-01-01';
    const secondDate = '2026-01-02';
    const lastDate = '2026-12-31';

    expect(result.length).toBe(365);
    expect(result[364]).toMatchObject({ date: lastDate, dailyActivities: 0, cumulativeActivities: 2 });
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
