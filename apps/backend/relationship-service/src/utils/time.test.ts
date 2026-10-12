import { isValidTimeZone, todayIn, zonedParts, zonedTimeToUtc } from './time';

describe('zonedTimeToUtc', () => {
  it('turns Tallinn summer time into UTC (UTC+3)', () => {
    expect(zonedTimeToUtc('2026-07-10', '19:00', 'Europe/Tallinn').toISOString()).toBe('2026-07-10T16:00:00.000Z');
  });

  it('turns Tallinn winter time into UTC (UTC+2)', () => {
    expect(zonedTimeToUtc('2026-12-10', '19:00', 'Europe/Tallinn').toISOString()).toBe('2026-12-10T17:00:00.000Z');
  });

  it('gets the day the clocks go back right', () => {
    // 25 October 2026: 04:00 EEST becomes 03:00 EET. Evening is already +2.
    expect(zonedTimeToUtc('2026-10-25', '19:00', 'Europe/Tallinn').toISOString()).toBe('2026-10-25T17:00:00.000Z');
  });

  it('gets the day the clocks go forward right', () => {
    // 29 March 2026: 03:00 EET becomes 04:00 EEST. Evening is already +3.
    expect(zonedTimeToUtc('2026-03-29', '19:00', 'Europe/Tallinn').toISOString()).toBe('2026-03-29T16:00:00.000Z');
  });

  it('moves a time the spring change skips an hour later', () => {
    expect(zonedTimeToUtc('2026-03-29', '03:30', 'Europe/Tallinn').toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('handles midnight, and zones west of UTC', () => {
    expect(zonedTimeToUtc('2026-10-16', '00:00', 'Europe/Tallinn').toISOString()).toBe('2026-10-15T21:00:00.000Z');
    expect(zonedTimeToUtc('2026-10-16', '20:00', 'America/New_York').toISOString()).toBe('2026-10-17T00:00:00.000Z');
  });
});

describe('zonedParts and todayIn', () => {
  it('is already the next day in Tallinn while UTC is on the previous one', () => {
    const at = new Date('2026-10-12T22:30:00Z'); // 01:30 on the 13th in Tallinn
    expect(todayIn(at)).toBe('2026-10-13');
    expect(todayIn(at, 'UTC')).toBe('2026-10-12');
    expect(zonedParts(at, 'Europe/Tallinn').time).toBe('01:30');
  });
});

describe('isValidTimeZone', () => {
  it('knows real zones and refuses made-up ones', () => {
    expect(isValidTimeZone('Europe/Tallinn')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
  });
});
