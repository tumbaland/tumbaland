/**
 * Trend helpers for the cash-flow charts.
 *
 * Bars show what each period actually was; a line over them shows the
 * direction of travel. Monthly spending is noisy enough — an annual insurance
 * bill, a holiday — that the bars alone do not answer "is this going up?".
 */

/**
 * Trailing mean over `window` periods. The first points average fewer periods
 * rather than being dropped, so the line starts where the bars do instead of
 * leaving an unexplained gap at the left edge.
 */
export function movingAverage(values: number[], window: number): number[] {
  if (window < 1) return [...values];

  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

/**
 * Slope of the least-squares line through the values, in units per period.
 * Answers "how much is this rising or falling each period on average", which
 * a first-to-last comparison gets wrong whenever either endpoint is atypical.
 */
export function linearTrend(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, v) => sum + v, 0) / n;

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    covariance += (i - meanX) * (values[i] - meanY);
    variance += (i - meanX) ** 2;
  }

  return variance === 0 ? 0 : covariance / variance;
}

/** Mean of the values, or 0 for an empty series. */
export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

export interface Profile {
  /** The middle month — what a normal one costs. */
  median: number;
  /** The quietest and heaviest month in the window. */
  low: number;
  high: number;
  /** The most recent month in the window, and how it sat against the median. */
  latest: number;
  latestIndex: number;
  values: number[];
}

/**
 * What a typical period looks like, from the last `count` of them.
 *
 * The median rather than the mean, because one annual insurance bill or one
 * holiday drags a mean far enough that it describes no actual month. The range
 * comes with it: a median on its own invites the reader to treat it as a
 * budget, and knowing the spread is what stops that.
 */
export function profile(values: number[], count: number): Profile | null {
  const window = count > 0 ? values.slice(-count) : [...values];
  if (window.length === 0) return null;

  const sorted = [...window].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];

  return {
    median,
    low: sorted[0],
    high: sorted[sorted.length - 1],
    latest: window[window.length - 1],
    latestIndex: window.length - 1,
    values: window
  };
}

/**
 * Totals over a sliding window — the trailing-twelve-months figure at every
 * point in the series.
 *
 * Only complete windows are returned, so the series starts where the first full
 * one ends. Including the partial windows at the front would draw a ramp out of
 * nothing and read as a period of explosive growth that never happened.
 *
 * Every point covers the same number of periods, which is exactly what calendar
 * buckets lack: a year or month still in progress is a stub, and setting it
 * beside a finished one makes every figure look like a collapse.
 */
export function rollingSum(values: number[], window: number): number[] {
  if (window < 1 || values.length < window) return [];

  const out: number[] = [];
  let total = values.slice(0, window).reduce((sum, v) => sum + v, 0);
  out.push(total);

  for (let i = window; i < values.length; i++) {
    total += values[i] - values[i - window];
    out.push(total);
  }
  return out;
}