import { daysBetween, monthStart, shiftDay, startOfDay, toDay, weekStart, weeksBetween } from './dates';

describe('dates', () => {
  it('names a UTC day', () => {
    expect(toDay(new Date('2026-10-27T23:59:59Z'))).toBe('2026-10-27');
  });

  it('moves a day across month and year ends', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDay('2026-10-27', 0)).toBe('2026-10-27');
  });

  it('lists every day in a range, both ends included', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(daysBetween('2026-10-27', '2026-10-27')).toEqual(['2026-10-27']);
    expect(daysBetween('2026-10-28', '2026-10-27')).toEqual([]);
  });

  it('finds the Monday of a week', () => {
    // 2026-10-26 is a Monday.
    expect(weekStart('2026-10-26')).toBe('2026-10-26');
    expect(weekStart('2026-10-27')).toBe('2026-10-26');
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // a Sunday belongs to the week before
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
  });

  it('counts whole weeks from a Monday', () => {
    expect(weeksBetween('2026-10-05', '2026-10-05')).toBe(0);
    expect(weeksBetween('2026-10-05', '2026-10-11')).toBe(0);
    expect(weeksBetween('2026-10-05', '2026-10-12')).toBe(1);
    expect(weeksBetween('2026-10-05', '2026-11-30')).toBe(8);
  });

  it('finds the start of a month and a day', () => {
    expect(monthStart(new Date('2026-10-27T12:00:00Z')).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(startOfDay('2026-10-27').toISOString()).toBe('2026-10-27T00:00:00.000Z');
  });
});
