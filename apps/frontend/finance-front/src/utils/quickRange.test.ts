import { quickRangeStart } from './quickRange';

const now = new Date(2026, 9, 28, 14, 0); // 28 October 2026

it.each([
  ['1m', '2026-09-28'],
  ['3m', '2026-07-28'],
  ['1y', '2025-10-28'],
  ['3y', '2023-10-28'],
  ['5y', '2021-10-28']
])('starts %s on %s', (range, expected) => {
  expect(quickRangeStart(range, now)).toBe(expected);
});

it('starts "all" at the earliest price on record', () => {
  expect(quickRangeStart('all', now, '2019-03-04T00:00:00.000Z')).toBe('2019-03-04T00:00:00.000Z');
});

it('starts "all" ten years back when there is no history yet', () => {
  expect(quickRangeStart('all', now)).toBe('2016-10-28');
});

it('reads a name it does not know as "all"', () => {
  expect(quickRangeStart('forever', now, '2020-01-01')).toBe('2020-01-01');
});

it('does not move the date it was given', () => {
  const given = new Date(2026, 9, 28);
  quickRangeStart('1y', given);
  expect(given.getFullYear()).toBe(2026);
});
