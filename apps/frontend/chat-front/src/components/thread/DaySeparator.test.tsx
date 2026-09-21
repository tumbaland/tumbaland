import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DaySeparator, dayLabel } from './DaySeparator';

/**
 * Built from local parts, not from a UTC string: `dayLabel` compares calendar
 * days in the viewer's own timezone, so a UTC fixture makes these tests pass
 * or fail depending on where they run.
 */
const at = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour);

const NOW = at(2026, 9, 21);

describe('dayLabel', () => {
  it('calls today today', () => {
    expect(dayLabel(at(2026, 9, 21, 8).toISOString(), NOW)).toBe('Today');
  });

  it('calls yesterday yesterday', () => {
    expect(dayLabel(at(2026, 9, 20, 8).toISOString(), NOW)).toBe('Yesterday');
  });

  it('uses the weekday within the last week, which reads better than a date', () => {
    // 2026-09-18 is a Friday.
    expect(dayLabel(at(2026, 9, 18, 8).toISOString(), NOW)).toBe('Friday');
  });

  it('uses a date beyond a week', () => {
    const label = dayLabel(at(2026, 9, 1, 8).toISOString(), NOW);
    expect(label).toMatch(/September/);
    expect(label).not.toMatch(/2026/);
  });

  it('includes the year for another year', () => {
    expect(dayLabel(at(2025, 9, 1, 8).toISOString(), NOW)).toMatch(/2025/);
  });

  it('is still today for a message later the same day', () => {
    expect(dayLabel(at(2026, 9, 21, 23).toISOString(), NOW)).toBe('Today');
  });

  it('says Today for a timestamp slightly in the future', () => {
    // An optimistic message carries the sending device's clock, which may run
    // a little fast. "Tomorrow" is not a label this renders, so without
    // clamping it would fall through to a weekday name.
    expect(dayLabel(at(2026, 9, 22, 9).toISOString(), NOW)).toBe('Today');
  });
});

describe('DaySeparator', () => {
  it('renders the label', () => {
    render(<DaySeparator iso={new Date().toISOString()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});
