jest.mock('../../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn(),
    findOne: jest.fn()
  }
}));

import { Activity } from '../../models/Activity';
import { getRelationshipStatistics } from './summary';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;
const mockedFindOne = Activity.findOne as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
  mockedFindOne.mockReturnValue({ sort: jest.fn().mockReturnValue({ select: jest.fn().mockResolvedValue(null) }) });
});

describe('getRelationshipStatistics', () => {
  it.each(['week', 'month', 'quarter', 'year', 'all', 'unknown'])(
    'computes a startDate for timeframe=%s without throwing',
    async (timeframe) => {
      await expect(getRelationshipStatistics(timeframe, { userId: 'u1' })).resolves.toBeDefined();
    }
  );

  it('counts in Tallinn days: today’s entries and the new month just after midnight', async () => {
    // 01:30 on 1 November in Tallinn is 23:30 UTC on 31 October.
    await getRelationshipStatistics('month', { userId: 'u1' }, new Date('2026-10-31T23:30:00Z'));
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: expect.objectContaining({
            date: { $gte: new Date('2026-11-01T00:00:00.000Z'), $lte: new Date('2026-11-01T00:00:00.000Z') }
          })
        }
      ])
    );
  });

  it('takes a week as today and the six days before it', async () => {
    await getRelationshipStatistics('week', { userId: 'u1' }, new Date('2026-10-12T12:00:00Z'));
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: expect.objectContaining({
            date: { $gte: new Date('2026-10-06T00:00:00.000Z'), $lte: new Date('2026-10-12T00:00:00.000Z') }
          })
        }
      ])
    );
  });

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

    expect(result.types[0]).toMatchObject({
      typeId: 'type-1',
      slug: 'reading',
      count: 3,
      totalHours: 4.56,
      uniqueDays: 2
    });
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
