jest.mock('../../models/Activity', () => ({
  Activity: {
    aggregate: jest.fn()
  }
}));

import { Activity } from '../../models/Activity';
import { getMilestones } from './milestones';

const mockedAggregate = Activity.aggregate as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedAggregate.mockResolvedValue([]);
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
    expect(result.recent).toContainEqual(expect.objectContaining({ kind: 'days-together', target: 300, daysAgo: 39 }));
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
