import { formatDay, localDayKey, todayKey } from './dates';

// The browser's zone, not UTC: 01:30 in Tallinn on 13 October is 22:30 UTC
// on the 12th, and a day key has to call it the 13th.
const originalTz = process.env.TZ;
afterEach(() => {
  // Assigning undefined would store the string "undefined", not clear it.
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe('localDayKey', () => {
  it('gives the local day just after midnight in Tallinn, when UTC is still on yesterday', () => {
    process.env.TZ = 'Europe/Tallinn';
    expect(localDayKey(new Date('2026-10-12T22:30:00Z'))).toBe('2026-10-13');
  });

  it('gives the local day late in the evening west of UTC', () => {
    process.env.TZ = 'America/New_York';
    expect(localDayKey(new Date('2026-10-13T02:30:00Z'))).toBe('2026-10-12');
  });

  it('pads months and days', () => {
    expect(localDayKey(new Date(2026, 0, 5, 12))).toBe('2026-01-05');
  });
});

it('todayKey is the local day of now', () => {
  expect(todayKey()).toBe(localDayKey(new Date()));
});

describe('formatDay', () => {
  it('writes the day the string names, whatever the zone', () => {
    process.env.TZ = 'Pacific/Auckland';
    expect(formatDay('2026-10-13', { day: 'numeric', month: 'numeric' })).toBe(
      new Date(2026, 9, 13).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })
    );
  });

  it('defaults to the year, short month and day', () => {
    expect(formatDay('2026-10-13')).toBe(
      new Date(2026, 9, 13).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    );
  });
});
