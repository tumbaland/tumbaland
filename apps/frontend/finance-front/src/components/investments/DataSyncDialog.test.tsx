import { describe, expect, it } from 'vite-plus/test';
import { closeDate, fetchedAtLabel, isStale, sessionsSince } from './DataSyncDialog';

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

describe('closeDate', () => {
  it("names the exact session, in the viewer's locale format", () => {
    const shown = closeDate(FRIDAY_CLOSE) as string;
    expect(shown).toContain('2026');
    expect(shown).toMatch(/\b0?7\b/); // the day
    expect(shown).toMatch(/\b0?8\b/); // the month
  });

  it('holds the session date in UTC, so it cannot drift a day behind the chart', () => {
    // A bar's date is a calendar date, not an instant. Converted to local time,
    // a viewer west of Greenwich would be shown the 6th for a session the chart
    // plots on the 7th — so both ends of the UTC day must render identically.
    expect(closeDate('2026-08-07T00:00:00.000Z')).toBe(closeDate('2026-08-07T23:59:59.000Z'));
    expect(closeDate(FRIDAY_CLOSE)).not.toMatch(/\b0?6\b/);
  });

  it('has nothing to show for an instrument with no close', () => {
    expect(closeDate(null)).toBeNull();
    expect(closeDate('not a date')).toBeNull();
  });
});

describe('fetchedAtLabel', () => {
  it('reports the fetch to the second', () => {
    const shown = fetchedAtLabel('2026-08-10T22:00:07.000Z') as string;
    expect(shown).toContain('2026');
    // Seconds are the point: they separate a run that just happened from one
    // that did not, which a date alone cannot show.
    expect(shown).toMatch(/\d{1,2}:\d{2}:\d{2}/);
  });

  it("is an instant, so it does move with the viewer's zone", () => {
    // Unlike a session date, "when did my machine last get data" is a real
    // moment and belongs in local time.
    //
    // Asserted against the same locale rendering rather than by searching for
    // a 24-hour hour string: `toLocaleString` may format 12-hour, so 22:00Z
    // reads as "10:00:07 PM" and the old check only passed in zones where the
    // local hour landed below 13. It was green in EEST and red in CI's UTC.
    const iso = '2026-08-10T22:00:07.000Z';
    const label = fetchedAtLabel(iso) as string;

    expect(label).toBe(
      new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    );
    // And not the raw instant: that would be the same for every viewer.
    expect(label).not.toContain('Z');
    expect(label).not.toBe(iso);
  });

  it('has nothing to show before the first fetch', () => {
    expect(fetchedAtLabel(null)).toBeNull();
    expect(fetchedAtLabel('not a date')).toBeNull();
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
