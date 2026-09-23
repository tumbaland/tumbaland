jest.mock('../../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn()
  }
}));

import { Activity } from '../../models/Activity';
import { getWeeklyHeatmapData } from './heatmap';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
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
