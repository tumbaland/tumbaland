import { accessQueryFor, dayKeyOf, dayNumber, toDayKey } from './shared';

describe('accessQueryFor', () => {
  it('reads one group when a group is asked for', () => {
    expect(accessQueryFor({ userId: 'u1', userGroupIds: ['g1', 'g2'], groupId: 'g1' })).toEqual({ groupId: 'g1' });
  });

  it("reads only a user's entries that carry no group in personal context", () => {
    expect(accessQueryFor({ userId: 'u1', personalOnly: true })).toEqual({
      userId: 'u1',
      $or: [{ groupId: null }, { groupId: { $exists: false } }]
    });
  });

  it('reads everything the user can reach otherwise', () => {
    const query = accessQueryFor({ userId: 'u1', userGroupIds: ['g1'] });

    expect(JSON.stringify(query)).toContain('u1');
    expect(JSON.stringify(query)).toContain('g1');
  });

  it('adds no scope without a user', () => {
    expect(accessQueryFor({})).toEqual({});
  });
});

describe('day helpers', () => {
  it('numbers consecutive days one apart, across a month end', () => {
    expect(dayNumber('2026-03-01') - dayNumber('2026-02-28')).toBe(1);
  });

  it('turns a day number back into the same key', () => {
    expect(dayKeyOf(dayNumber('2024-02-29'))).toBe('2024-02-29');
  });

  it('keys a stored date by its UTC day', () => {
    expect(toDayKey(new Date('2026-01-01T23:30:00.000Z'))).toBe('2026-01-01');
  });
});
