import { localDayKey } from '@tumbaland/frontend-core';

/** The ranges the history picker offers, besides "all". */
export const QUICK_RANGES = ['1m', '3m', '1y', '3y', '5y', 'all'] as const;
export type QuickRange = (typeof QUICK_RANGES)[number];

const MONTHS_BACK: Record<string, number> = { '1m': 1, '3m': 3 };
const YEARS_BACK: Record<string, number> = { '1y': 1, '3y': 3, '5y': 5 };

/** When "all" has no history to look at, it reaches this far back. */
const FALLBACK_YEARS = 10;

/**
 * The first day of a quick range, as YYYY-MM-DD in the browser's time zone; the
 * last day is always today.
 *
 * "All" starts at the earliest price on record (`earliest`, any date string
 * that sorts as one), or ten years ago when there is none yet. A name it does
 * not know is read as "all".
 */
export function quickRangeStart(range: string, now: Date, earliest?: string): string {
  const start = new Date(now);
  if (range in MONTHS_BACK) {
    start.setMonth(start.getMonth() - MONTHS_BACK[range]);
  } else if (range in YEARS_BACK) {
    start.setFullYear(start.getFullYear() - YEARS_BACK[range]);
  } else if (earliest) {
    return earliest;
  } else {
    start.setFullYear(start.getFullYear() - FALLBACK_YEARS);
  }
  return localDayKey(start);
}
