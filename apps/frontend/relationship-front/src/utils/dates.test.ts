import { localDayKey } from './dates';

// The browser's zone, not UTC: 01:30 in Tallinn on 13 October is 22:30 UTC
// on the 12th, and the journal has to call it the 13th.
const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

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
