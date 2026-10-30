import { isOpenAt, parseHours, parseMoment } from './openingHours';

// 2026-10-30 is a Friday. Sunday is 0.
const FRI = 5;
const SAT = 6;
const SUN = 0;
const at = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

describe('isOpenAt', () => {
  it('reads days, ranges and times', () => {
    const hours = 'Mo-Fr 11:00-22:00; Sa,Su 12:00-23:00';
    expect(isOpenAt(hours, FRI, at('21:30'))).toBe(true);
    expect(isOpenAt(hours, FRI, at('22:00'))).toBe(false);
    expect(isOpenAt(hours, FRI, at('10:59'))).toBe(false);
    expect(isOpenAt(hours, SAT, at('22:30'))).toBe(true);
  });

  it('lets a later rule replace an earlier one for the days it names', () => {
    expect(isOpenAt('Mo-Su 10:00-22:00; Fr 10:00-18:00', FRI, at('21:00'))).toBe(false);
    expect(isOpenAt('Mo-Su 10:00-22:00; Su off', SUN, at('12:00'))).toBe(false);
    expect(isOpenAt('Mo-Su 10:00-22:00; Su off', SAT, at('12:00'))).toBe(true);
  });

  it('reads several time ranges in a day', () => {
    const hours = 'Mo-Su 12:00-15:00, 18:00-23:00';
    expect(isOpenAt(hours, FRI, at('16:00'))).toBe(false);
    expect(isOpenAt(hours, FRI, at('19:00'))).toBe(true);
  });

  it('follows a night past midnight into the next morning', () => {
    const hours = 'Fr,Sa 18:00-02:00';
    expect(isOpenAt(hours, FRI, at('23:30'))).toBe(true);
    expect(isOpenAt(hours, SAT, at('01:00'))).toBe(true);
    expect(isOpenAt(hours, SUN, at('01:00'))).toBe(true);
    expect(isOpenAt(hours, SUN, at('03:00'))).toBe(false);
  });

  it('wraps a day range over the weekend', () => {
    expect(isOpenAt('Fr-Mo 10:00-20:00', SUN, at('12:00'))).toBe(true);
    expect(isOpenAt('Fr-Mo 10:00-20:00', 3, at('12:00'))).toBe(false);
  });

  it('knows 24/7, and takes 24:00 as the end of the day', () => {
    expect(isOpenAt('24/7', 3, at('04:00'))).toBe(true);
    expect(isOpenAt('Mo-Su 08:00-24:00', FRI, at('23:59'))).toBe(true);
  });

  it('skips a public holiday rule rather than failing on it', () => {
    expect(isOpenAt('Mo-Su 10:00-22:00; PH off', FRI, at('12:00'))).toBe(true);
  });

  it('says unknown, not closed, for what it does not read or when there is nothing', () => {
    expect(isOpenAt(undefined, FRI, at('12:00'))).toBeNull();
    expect(isOpenAt('', FRI, at('12:00'))).toBeNull();
    expect(isOpenAt('Mo-Fr sunrise-sunset', FRI, at('12:00'))).toBeNull();
    expect(isOpenAt('Jan-Mar Mo-Fr 10:00-12:00', FRI, at('11:00'))).toBeNull();
    expect(isOpenAt('Mo-Fr 10:00-12:00 open "by appointment"', FRI, at('11:00'))).toBeNull();
    expect(parseHours('nonsense')).toBeNull();
  });
});

describe('parseMoment', () => {
  it('reads a local time and its weekday', () => {
    expect(parseMoment('2026-10-30T21:30')).toEqual({ weekday: FRI, minutes: 21 * 60 + 30 });
  });
  it.each([['2026-10-30'], ['2026-10-30T25:00'], ['2026-02-31T10:00'], ['tonight']])('refuses %s', (text) => {
    expect(parseMoment(text)).toBeNull();
  });
});
