jest.mock('../../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn()
  }
}));

import { Activity } from '../../models/Activity';
import { getStreakStatistics } from './streaks';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
});

describe('getStreakStatistics', () => {
  const NOW = new Date('2026-03-10T09:30:00.000Z');

  /** The two aggregations run in order: distinct logged days, then per-type rows. */
  function mockStreakAggregations(days: string[], types: unknown[] = []) {
    mockedAggregate.mockResolvedValueOnce(days.map((d) => ({ _id: d }))).mockResolvedValueOnce(types);
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

  it('counts the Tallinn day just after midnight, while UTC is still on yesterday', async () => {
    // 01:30 on 11 March in Tallinn is 23:30 UTC on the 10th. An entry for the
    // 11th was logged a minute ago and has to be today, not the future.
    mockStreakAggregations(['2026-03-10', '2026-03-11']);
    const result = await getStreakStatistics({ userId: 'u1' }, new Date('2026-03-10T23:30:00Z'));
    expect(mockedAggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        { $match: expect.objectContaining({ date: { $lt: new Date('2026-03-12T00:00:00.000Z') } }) }
      ])
    );
    expect(result.currentStreak).toBe(2);
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
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04', // longest: 4
      '2026-03-08',
      '2026-03-09',
      '2026-03-10' // current: 3, ends today
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
    mockStreakAggregations([], [typeRow({ firstDate: new Date('2026-02-04'), loggedDays: ['2026-02-04'] })]);

    const [type] = (await getStreakStatistics({ userId: 'u1' }, NOW)).types;

    expect(type).toMatchObject({ loggedDays: 1, typicalGapDays: null, overdueRatio: null });
  });

  it('leaves the cadence unknown for several entries on a single day', async () => {
    mockStreakAggregations(
      [],
      [typeRow({ firstDate: new Date('2026-02-04'), loggedDays: ['2026-02-04', '2026-02-04'] })]
    );

    const [type] = (await getStreakStatistics({ userId: 'u1' }, NOW)).types;

    // $addToSet cannot actually return a duplicate — this guards the divide-by-zero
    // path that a zero-length span would otherwise open.
    expect(type).toMatchObject({ typicalGapDays: 0, overdueRatio: null });
  });

  it('sorts by how overdue each type is, with unknown cadences last', async () => {
    const oneOff = (slug: string, day: string) =>
      typeRow({ _id: slug, slug, firstDate: new Date(day), lastDate: new Date(day), loggedDays: [day] });

    mockStreakAggregations(
      [],
      [
        // no rhythm at all — these sort last, oldest first, whichever order they arrive in
        oneOff('once-recent', '2026-03-01'),
        // due exactly now: 34 days since, on a 34-day cadence
        typeRow({ _id: 'due', slug: 'due', loggedDays: ['2026-01-01', '2026-02-04'] }),
        // 2x overdue
        typeRow({ _id: 'overdue', slug: 'overdue' }),
        oneOff('once-old', '2026-01-05')
      ]
    );

    const result = await getStreakStatistics({ userId: 'u1' }, NOW);

    expect(result.types.map((t) => t.slug)).toEqual(['overdue', 'due', 'once-old', 'once-recent']);
  });
});
