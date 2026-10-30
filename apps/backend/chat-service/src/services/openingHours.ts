/**
 * Whether a place is open at a given time, from OpenStreetMap's `opening_hours`
 * tag: `Mo-Fr 11:00-22:00; Sa,Su 12:00-23:00`.
 *
 * Only the common forms are read: days, day ranges, times, several time ranges,
 * `off`, `24/7`, and a night that runs past midnight. Anything else (sunrise,
 * months, week numbers, "every second Friday") makes the answer "unknown", which
 * is shown as such. Wrong is worse than unknown: someone walks to a closed door.
 * Rules about public holidays are skipped, since the date asked about is not
 * checked against a holiday calendar.
 *
 * Weekdays are numbered as JavaScript does: Sunday is 0.
 */

const DAYS: Record<string, number> = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
/** Start and end in minutes since midnight. An end past 1440 runs into the next day. */
type Span = [number, number];
type Week = Span[][];

const minutes = (text: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]);
  return Number(match[2]) < 60 && total <= 1440 ? total : null;
};

/** `Mo-Fr`, `Sa,Su`, `Fr-Mo`: the weekdays named, or null for something this does not read. */
function days(selector: string): number[] | null {
  const out = new Set<number>();
  for (const part of selector.split(',')) {
    const range = /^([A-Z][a-z])(?:-([A-Z][a-z]))?$/.exec(part.trim());
    if (!range || !(range[1]! in DAYS) || (range[2] && !(range[2] in DAYS))) return null;
    const from = DAYS[range[1]!]!;
    const to = range[2] ? DAYS[range[2]]! : from;
    for (let day = from; ; day = (day + 1) % 7) {
      out.add(day);
      if (day === to) break;
    }
  }
  return [...out];
}

export function parseHours(text: string): Week | null {
  const value = text.trim();
  if (!value) return null;
  if (value === '24/7') return Array.from({ length: 7 }, () => [[0, 1440]] as Span[]);

  const week: Week = Array.from({ length: 7 }, () => []);
  for (const rule of value.split(';').map((part) => part.trim()).filter(Boolean)) {
    // Holidays: not checked against a calendar, so not read.
    if (/^(PH|SH)\b/.test(rule)) continue;
    const match = /^(?:([A-Za-z,-]+)\s+)?(off|closed|\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*)$/.exec(rule);
    if (!match) return null;
    const selected = match[1] ? days(match[1]) : [0, 1, 2, 3, 4, 5, 6];
    if (!selected) return null;

    const spans: Span[] = [];
    if (match[2] !== 'off' && match[2] !== 'closed') {
      for (const range of match[2]!.split(',')) {
        const [from, to] = range.trim().split('-').map((time) => minutes(time!));
        if (from === null || to === null || from === undefined || to === undefined) return null;
        spans.push([from, to <= from ? to + 1440 : to]);
      }
    }
    // A later rule replaces the earlier one for the days it names.
    for (const day of selected) week[day] = spans;
  }
  return week;
}

/** True, false, or null when the tag is missing or not one this reads. */
export function isOpenAt(hours: string | undefined, weekday: number, at: number): boolean | null {
  const week = hours ? parseHours(hours) : null;
  if (!week) return null;
  const today = week[weekday]!.some(([from, to]) => at >= from && at < to);
  // Yesterday's night that ran past midnight into this morning.
  const carried = week[(weekday + 6) % 7]!.some(([, to]) => to > 1440 && at < to - 1440);
  return today || carried;
}

/** `2026-10-30T21:30` as a weekday and minutes, or null when it is not a real time. */
export function parseMoment(text: string): { weekday: number; minutes: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [number, number, number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return { weekday: date.getUTCDay(), minutes: hour * 60 + minute };
}
