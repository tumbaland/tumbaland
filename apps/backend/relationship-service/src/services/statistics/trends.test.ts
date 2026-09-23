jest.mock('../../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn()
  }
}));

import { Activity } from '../../models/Activity';
import { getTrends } from './trends';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
});

describe('getTrends', () => {
  const NOW = new Date('2026-03-10T09:30:00.000Z');

  function row(typeId: string, window: 'current' | 'previous', overrides: Record<string, unknown> = {}) {
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
    mockedAggregate.mockResolvedValue([row('t1', 'current', { entries: 5 }), row('t1', 'previous', { entries: 5 })]);

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
