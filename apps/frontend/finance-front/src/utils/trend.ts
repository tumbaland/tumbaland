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

/**
 * Percentage change from the first half of the series to the second. Comparing
 * halves rather than endpoints keeps one unusual month at either end from
 * deciding the answer.
 */
export function halfOverHalfChange(values: number[]): number | null {
  if (values.length < 2) return null;

  const midpoint = Math.floor(values.length / 2);
  const earlier = mean(values.slice(0, midpoint));
  const later = mean(values.slice(midpoint));

  if (earlier === 0) return null;
  return ((later - earlier) / earlier) * 100;
}
