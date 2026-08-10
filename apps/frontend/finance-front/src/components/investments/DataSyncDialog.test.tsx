import { describe, expect, it } from 'vitest';
import { freshnessLabel, isStale, sessionsSince } from './DataSyncDialog';

/**
 * Freshness is measured in trading sessions, not calendar days, and the cases
 * that matter are the ones where the two disagree: weekends, Mondays and
 * exchange holidays, when a market simply produces no bar and the absence is
 * not an outage.
 */

// A Friday close, and the days it is read on. 2026-08-07 is a Friday.
const FRIDAY_CLOSE = '2026-08-07T00:00:00.000Z';
const at = (iso: string) => new Date(iso);

describe('sessionsSince', () => {
  it('counts no missed session over the weekend or on the following Monday', () => {
    expect(sessionsSince(FRIDAY_CLOSE, at('2026-08-08T12:00:00Z'))).toBe(0); // Saturday
    expect(sessionsSince(FRIDAY_CLOSE, at('2026-08-09T12:00:00Z'))).toBe(0); // Sunday
    expect(sessionsSince(FRIDAY_CLOSE, at('2026-08-10T12:00:00Z'))).toBe(0); // Monday
  });

  it('starts counting once a session has closed without producing a bar', () => {
    expect(sessionsSince(FRIDAY_CLOSE, at('2026-08-11T12:00:00Z'))).toBe(1); // Monday missed
    expect(sessionsSince(FRIDAY_CLOSE, at('2026-08-12T12:00:00Z'))).toBe(2);
  });

  it('skips the weekend when counting across one', () => {
    // Thu 2026-08-13 close read on Mon 2026-08-17: only Friday was missed.
    expect(sessionsSince('2026-08-13T00:00:00.000Z', at('2026-08-17T12:00:00Z'))).toBe(1);
  });

  it('has no answer for an instrument with no close', () => {
    expect(sessionsSince(null)).toBeNull();
    expect(sessionsSince('not a date')).toBeNull();
  });
});

describe('freshnessLabel', () => {
  it("does not age a Friday close over the weekend it cannot trade through", () => {
    // The regression this replaces: every Monday read "3 days ago" for the
    // newest bar that existed anywhere.
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-08-08T12:00:00Z'))).toBe('up to date');
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-08-09T12:00:00Z'))).toBe('up to date');
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-08-10T12:00:00Z'))).toBe('up to date');
  });

  it("says so plainly when the bar is today's", () => {
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-08-07T18:00:00Z'))).toBe('today');
  });

  it('reports the deficit in sessions once the job actually misses one', () => {
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-08-11T12:00:00Z'))).toBe('1 session behind');
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-08-13T12:00:00Z'))).toBe('3 sessions behind');
  });

  it('falls back to calendar wording once a session count stops being readable', () => {
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-08-19T12:00:00Z'))).toBe('last week');
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-09-07T12:00:00Z'))).toBe('4 weeks ago');
    expect(freshnessLabel(FRIDAY_CLOSE, at('2026-11-07T12:00:00Z'))).toBe('3 months ago');
  });

  it('distinguishes an instrument that never had a price', () => {
    expect(freshnessLabel(null)).toBe('never');
  });
});

describe('isStale', () => {
  it('tolerates the weekend and the Monday before the evening job runs', () => {
    expect(isStale(FRIDAY_CLOSE, 'daily', at('2026-08-10T12:00:00Z'))).toBe(false);
    expect(isStale(FRIDAY_CLOSE, 'daily', at('2026-08-11T12:00:00Z'))).toBe(false);
  });

  it('flags a daily series once more than one session is missing', () => {
    expect(isStale(FRIDAY_CLOSE, 'daily', at('2026-08-12T12:00:00Z'))).toBe(true);
  });

  it('gives a weekly series a fortnight', () => {
    expect(isStale(FRIDAY_CLOSE, 'weekly', at('2026-08-20T12:00:00Z'))).toBe(false);
    expect(isStale(FRIDAY_CLOSE, 'weekly', at('2026-08-25T12:00:00Z'))).toBe(true);
  });

  it('does not call a never-fetched instrument stale', () => {
    expect(isStale(null, 'daily')).toBe(false);
  });
});
