// The efficient frontier of the holdings, from historical returns.
//
// The covariance comes from the price history, which is what history is good at.
// The expected returns do not: a mean estimated from a few years is mostly noise,
// and an optimizer will faithfully put the money wherever the noise was highest.
// So expected returns are blended toward a long-run anchor by default, and the
// frontier itself is solved (see optimizer.ts) rather than sampled. A cloud of
// random portfolios is still computed, only to show where the ordinary ones sit.
import { mean, covariance } from './portfolioMath';
import {
  DEFAULT_ANCHOR_PCT,
  ReturnMode,
  expectedReturnsPct,
  historyWeight,
  optimize,
  OptimalPortfolio,
  projectCappedSimplex
} from './optimizer';

export const TRADING_DAYS = 252;
export const TRADING_WEEKS = 52;

/**
 * Which series the estimate is fitted to.
 *
 * Not a display preference: it changes the arithmetic. A weekly return
 * annualized by 252 instead of 52 overstates the figure roughly fivefold, so
 * the basis travels with the data everywhere it is used.
 *
 * Weekly exists because the provider's free tier caps daily history at ~100
 * trading days while serving the entire weekly series — for many instruments
 * that is five months against a decade, and a covariance estimate cares far
 * more about how much history it has seen than about how finely it was sampled.
 */
export type ReturnBasis = 'daily' | 'weekly';

export const PERIODS_PER_YEAR: Record<ReturnBasis, number> = {
  daily: TRADING_DAYS,
  weekly: TRADING_WEEKS
};

/**
 * How long a hole may be before the "return" across it stops being one period.
 *
 * Daily closes sit 1–3 days apart, so ten days clears any holiday run. Weekly
 * closes sit seven days apart, and a fortnight means a week is missing — the
 * tolerance is per basis because a gap that is routine for one is a data
 * problem for the other.
 */
export const MAX_GAP_DAYS: Record<ReturnBasis, number> = {
  daily: 10,
  weekly: 16
};

/**
 * A close, with the day it belongs to. Dates are what make a covariance
 * meaningful: `covariance` pairs its inputs by *position*, so two series that
 * start on different days would have 2015 returns of one asset scored against
 * 2026 returns of another. Every series here is therefore cut down to the days
 * on which all of them traded before a single return is computed.
 */
export interface PricePoint {
  /** ISO date; only the `YYYY-MM-DD` prefix is compared. */
  date: string;
  price: number;
}

/** Kept as the daily default for callers that do not name a basis. */
export const MAX_RETURN_GAP_DAYS = MAX_GAP_DAYS.daily;

export interface AlignedSeries {
  tickers: string[];
  /** Days on which every ticker traded, ascending. */
  dates: string[];
  /** Prices per ticker, indexed against `dates`. */
  prices: number[][];
  /** Calendar span of `dates`, which is the history the frontier actually has. */
  spanDays: number;
}

const dayOf = (date: string): string => date.slice(0, 10);

/**
 * Cuts every series down to the days all of them share.
 *
 * The intersection, not the union: a covariance needs both assets observed on
 * the same day, and filling a missing day (carrying the last close forward)
 * would invent a zero return and bias the correlation towards whatever asset
 * has the sparser data.
 */
export function alignSeries(pricesByTicker: Record<string, PricePoint[]>): AlignedSeries {
  const tickers = Object.keys(pricesByTicker);
  if (tickers.length === 0) return { tickers, dates: [], prices: [], spanDays: 0 };

  const byDate = tickers.map(t => {
    const map = new Map<string, number>();
    // Later rows win, which matters only for a duplicated date; the series are
    // otherwise one row per day.
    for (const point of pricesByTicker[t]) map.set(dayOf(point.date), point.price);
    return map;
  });

  const dates = Array.from(byDate[0].keys())
    .filter(date => byDate.every(map => map.has(date)))
    .sort();

  const prices = byDate.map(map => dates.map(date => map.get(date)!));
  const spanDays =
    dates.length > 1
      ? Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86_400_000)
      : 0;

  return { tickers, dates, prices, spanDays };
}

/**
 * Indices into an aligned series at which a return may be taken — every day
 * whose predecessor is close enough in time to be the previous trading day.
 *
 * Computed once from the shared date axis and applied to every ticker, so the
 * return vectors stay index-aligned with each other.
 */
export function returnIndices(dates: string[], maxGapDays: number = MAX_GAP_DAYS.daily): number[] {
  const indices: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const gap = (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 86_400_000;
    if (gap <= maxGapDays) indices.push(i);
  }
  return indices;
}

/**
 * A weekly series must cover this many times as much market as the daily one
 * before it is preferred. Over the same stretch daily has five times the
 * observations, which is worth more than a few extra weeks of reach.
 */
export const WEEKLY_REACH_ADVANTAGE = 1.5;

/** Years of market a series covers, in trading days: observations scaled to a year. */
export const coverageDays = (observations: number, basis: ReturnBasis) =>
  (observations * TRADING_DAYS) / PERIODS_PER_YEAR[basis];

export interface LimitingHolding {
  ticker: string;
  /** The first day it has a price. */
  since: string;
  /** Years the holdings share now, and the years they would share without it. */
  yearsWith: number;
  yearsWithout: number;
}

/**
 * The holding whose short history sets the length of everyone's, when leaving it
 * out would clearly lengthen the sample. The frontier is only as long as the days
 * all holdings traded, so one young fund caps the rest.
 *
 * Null when it would not matter much, or when leaving one out would leave fewer
 * than three holdings, which is too few to say anything about a frontier.
 */
export function findLimitingHolding(
  pricesByTicker: Record<string, PricePoint[]>,
  minGain = 1.3
): LimitingHolding | null {
  const tickers = Object.keys(pricesByTicker);
  if (tickers.length < 4) return null;

  const firstDay = (t: string) => dayOf(pricesByTicker[t][0].date);
  const byYoungest = [...tickers].sort((a, b) => firstDay(b).localeCompare(firstDay(a)));
  const [youngest, next] = byYoungest;
  // A tie means leaving one out does not help: the other starts the same day.
  if (firstDay(youngest) === firstDay(next)) return null;

  const withAll = alignSeries(pricesByTicker);
  const rest = Object.fromEntries(tickers.filter((t) => t !== youngest).map((t) => [t, pricesByTicker[t]]));
  const without = alignSeries(rest);
  if (withAll.spanDays <= 0 || without.spanDays < withAll.spanDays * minGain) return null;

  return {
    ticker: youngest,
    since: firstDay(youngest),
    yearsWith: withAll.spanDays / 365,
    yearsWithout: without.spanDays / 365
  };
}

export interface SimPoint {
  ret: number; // annualized return, %
  vol: number; // annualized volatility, %
  sharpe: number;
  weights: number[];
}

/** What the optimizer was given, so anything derived from the frontier can use the same inputs. */
export interface FrontierModel {
  /** Expected annual return of each holding, decimal, under the chosen mode. */
  mu: number[];
  /** Annualized covariance of the holdings. */
  cov: number[][];
  /** Each holding's period returns over the shared window, for looking back. */
  returnSeries: number[][];
  periodsPerYear: number;
}

export interface FrontierSim {
  tickers: string[];
  /** A cloud of random long-only portfolios, for context. Not where the answer comes from. */
  points: SimPoint[];
  /** The solved efficient frontier, least risk first. */
  frontier: SimPoint[];
  /** The most any one holding may weigh, as a share, after allowing for an equal split. */
  cap: number;
  model: FrontierModel;
  maxSharpe: SimPoint;
  minVol: SimPoint;
  current: SimPoint | null;
  dataPoints: number; // number of trading days used
  /** Every input the numbers above were derived from, for the page to show its working. */
  breakdown: SimBreakdown;
}

/** What one holding contributed to the estimate, in the units it was estimated in. */
export interface AssetBreakdown {
  ticker: string;
  /** Share of portfolio value on the last shared day, `null` when quantities are unknown. */
  weight: number | null;
  /**
   * Mean of its returns over one period of the chosen basis — daily or weekly.
   * The raw quantity everything else scales.
   */
  meanPeriod: number;
  /** `meanPeriod × periodsPerYear`, as a percentage: the annualization the frontier uses. */
  annualizedPct: number;
  /** `√(variance × 252)`, as a percentage. */
  volPct: number;
  /** What it actually did between the first and last day of the sample. */
  windowReturnPct: number;
  /** `weight × annualizedPct` — how much of the portfolio figure came from here. */
  contributionPct: number | null;
}

/**
 * The estimate with its error bar, which is the part a single percentage hides.
 *
 * A mean estimated from `n` daily returns carries a standard error of
 * `σ/√n`, and annualizing multiplies it by 252 — so a short sample produces a
 * confident-looking number with an interval wide enough to contain a loss. This
 * is reported alongside the point estimate rather than instead of it: the
 * optimizer legitimately runs on arithmetic means, and only the *reading* of
 * them needs the caveat.
 */
export interface PortfolioBreakdown {
  /** `Σ wᵢμᵢ × 252` — what the frontier plots. */
  arithmeticPct: number;
  volPct: number;
  /** `σ²/2`, the gap between the average yearly return and the compounded one. */
  varianceDragPct: number;
  /** `arithmetic − drag`: what a euro would actually have grown at. */
  geometricPct: number;
  sharpe: number;
  /** Annualized standard error of `arithmeticPct`. */
  standardErrorPct: number;
  /** 95% interval for the mean, `± 1.96 SE`. */
  ci95: [number, number];
}

export interface SimBreakdown {
  /** Which series the estimate was fitted to, and therefore how it was annualized. */
  basis: ReturnBasis;
  /** 252 or 52 — the factor every annualized figure below was multiplied by. */
  periodsPerYear: number;
  /** The dates every holding traded, which is what the estimate is fitted to. */
  window: { from: string; to: string; observations: number; spanDays: number };
  /**
   * The sample expressed in trading days, so callers can weigh it without
   * knowing the basis.
   *
   * Anything that judges "how much history is this" by counting observations
   * silently discounts a weekly fit fivefold — 128 weekly closes are two and a
   * half years of market, not two and a half months. The projection's shrinkage
   * is exactly such a caller.
   */
  equivalentTradingDays: number;
  assets: AssetBreakdown[];
  /** Correlations between returns on `basis` — what a frontier is actually made of. */
  correlations: number[][];
  /** For the portfolio the user actually holds; `null` without quantities. */
  current: PortfolioBreakdown | null;
  riskFreeRatePct: number;
  /** How the returns the optimizer worked with were arrived at. */
  expected: ExpectedReturns;
}

export interface ExpectedReturns {
  mode: ReturnMode;
  /** What every holding is assumed to earn before looking at its past, % a year. */
  anchorPct: number;
  /** How much of each expected return is history rather than the anchor, 0 to 1. */
  historyWeight: number;
  /** Per holding, % a year, under the mode. */
  perAssetPct: number[];
}

/**
 * Everything the frontier claims about one set of weights, decomposed.
 *
 * Exported so the page can describe a *proposed* portfolio (the target on the
 * slider) with the same arithmetic it describes the current one — two code
 * paths for the same formula is how a "how this is calculated" panel starts
 * disagreeing with the chart above it.
 */
export function describePortfolio(
  weights: number[],
  means: number[],
  cov: number[][],
  riskFreeRatePct: number,
  observations: number,
  basis: ReturnBasis = 'daily'
): PortfolioBreakdown {
  const periods = PERIODS_PER_YEAR[basis];
  const rfPeriod = riskFreeRatePct / 100 / periods;
  const { ret, vol, sharpe } = portfolioStats(weights, means, cov, rfPeriod, periods);

  let periodVar = 0;
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights.length; j++) periodVar += weights[i] * weights[j] * cov[i][j];

  const varianceDragPct = ((periodVar * periods) / 2) * 100;
  const standardErrorPct = observations > 0
    ? Math.sqrt(Math.max(0, periodVar) / observations) * periods * 100
    : 0;

  return {
    arithmeticPct: ret,
    volPct: vol,
    varianceDragPct,
    geometricPct: ret - varianceDragPct,
    sharpe,
    standardErrorPct,
    ci95: [ret - 1.96 * standardErrorPct, ret + 1.96 * standardErrorPct]
  };
}

export function dailyReturns(prices: number[], indices?: number[]): number[] {
  const at = indices ?? Array.from({ length: Math.max(0, prices.length - 1) }, (_, i) => i + 1);
  return at.map(i => (prices[i] - prices[i - 1]) / prices[i - 1]);
}

/**
 * `rfPeriod` and `periods` must describe the same period as `means` and `cov` —
 * per-day for a daily fit, per-week for a weekly one.
 */
export function portfolioStats(
  weights: number[],
  means: number[],
  cov: number[][],
  rfPeriod: number,
  periods: number = TRADING_DAYS
): { ret: number; vol: number; sharpe: number } {
  const periodRet = weights.reduce((s, w, i) => s + w * means[i], 0);
  let periodVar = 0;
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights.length; j++)
      periodVar += weights[i] * weights[j] * cov[i][j];
  const ret = periodRet * periods * 100;
  const vol = Math.sqrt(Math.max(0, periodVar * periods)) * 100;
  const sharpe = vol > 0 ? (ret - rfPeriod * periods * 100) / vol : 0;
  return { ret, vol, sharpe };
}

// Dirichlet-like random weights (exponential trick for uniform distribution on simplex)
export function randomWeights(n: number): number[] {
  const raw = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-10));
  const sum = raw.reduce((s, x) => s + x, 0);
  return raw.map(x => x / sum);
}

const toPoint = (p: OptimalPortfolio): SimPoint => ({
  ret: p.ret * 100,
  vol: p.vol * 100,
  sharpe: p.sharpe,
  weights: p.weights
});

export function runFrontierSimulation(opts: {
  pricesByTicker: Record<string, PricePoint[]>;
  quantityByTicker: Record<string, number>;
  riskFreeRatePct: number;
  /** How many random portfolios to scatter for context. */
  simulations?: number;
  /** Which series `pricesByTicker` holds. Decides the annualization factor. */
  basis?: ReturnBasis;
  /** Whether returns come from history, are blended toward the anchor (default), or are all equal. */
  returnMode?: ReturnMode;
  /** The long-run return every holding is assumed to earn before looking at its own past, % a year. */
  anchorPct?: number;
  /** The most any one holding may weigh, in percent. 100 means no limit. */
  maxWeightPct?: number;
}): FrontierSim | null {
  const {
    pricesByTicker,
    quantityByTicker,
    riskFreeRatePct,
    simulations = 600,
    basis = 'daily',
    returnMode = 'shrunk',
    anchorPct = DEFAULT_ANCHOR_PCT,
    maxWeightPct = 100
  } = opts;
  const periods = PERIODS_PER_YEAR[basis];
  const { tickers, dates, prices: aligned } = alignSeries(pricesByTicker);
  if (tickers.length < 2) return null;

  const at = returnIndices(dates, MAX_GAP_DAYS[basis]);
  if (at.length < 2) return null;

  const returnSeries = aligned.map(series => dailyReturns(series, at));
  const means = returnSeries.map(r => mean(r));
  const cov = tickers.map((_, i) => tickers.map((_, j) => covariance(returnSeries[i], returnSeries[j])));
  const rfPeriod = riskFreeRatePct / 100 / periods;

  // What each holding is expected to earn. History only informs this, in
  // proportion to how much of it there is.
  const equivalentTradingDays = Math.round((at.length * TRADING_DAYS) / periods);
  const historicalPct = means.map((m) => m * periods * 100);
  const expectedPct = expectedReturnsPct(historicalPct, returnMode, equivalentTradingDays, anchorPct);
  const expectedPeriodMeans = expectedPct.map((r) => r / 100 / periods);

  // The frontier is solved on annual figures.
  const mu = expectedPct.map((r) => r / 100);
  const covAnnual = cov.map((row) => row.map((c) => c * periods));
  const optimum = optimize(mu, covAnnual, riskFreeRatePct / 100, maxWeightPct / 100);

  // The cloud obeys the same limit as the frontier. Otherwise it fills with
  // portfolios the frontier is not allowed to hold, and some of them sit above it.
  const points: SimPoint[] = [];
  for (let s = 0; s < simulations; s++) {
    const w = optimum.cap < 1 ? projectCappedSimplex(randomWeights(tickers.length), optimum.cap) : randomWeights(tickers.length);
    points.push({ ...portfolioStats(w, expectedPeriodMeans, cov, rfPeriod, periods), weights: w });
  }

  const maxSharpe = toPoint(optimum.maxSharpe);
  const minVol = toPoint(optimum.minVol);

  // Valued on the last day they all traded, so the weights that come out
  // describe one moment rather than a mix of stale and fresh closes.
  const values = tickers.map((t, i) => (quantityByTicker[t] ?? 0) * aligned[i][aligned[i].length - 1]);
  const totalVal = values.reduce((s, v) => s + v, 0);

  let current: SimPoint | null = null;
  if (totalVal > 0) {
    const w = values.map(v => v / totalVal);
    current = { ...portfolioStats(w, expectedPeriodMeans, cov, rfPeriod, periods), weights: w };
  }

  const dataPoints = at.length;

  const variances = tickers.map((_, i) => cov[i][i]);
  const breakdown: SimBreakdown = {
    basis,
    periodsPerYear: periods,
    equivalentTradingDays,
    window: {
      from: dates[0],
      to: dates[dates.length - 1],
      observations: at.length,
      spanDays: Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86_400_000)
    },
    assets: tickers.map((ticker, i) => {
      const series = aligned[i];
      const weight = totalVal > 0 ? values[i] / totalVal : null;
      const annualizedPct = means[i] * periods * 100;
      return {
        ticker,
        weight,
        meanPeriod: means[i],
        annualizedPct,
        volPct: Math.sqrt(Math.max(0, variances[i] * periods)) * 100,
        windowReturnPct: ((series[series.length - 1] - series[0]) / series[0]) * 100,
        contributionPct: weight === null ? null : weight * annualizedPct
      };
    }),
    correlations: tickers.map((_, i) =>
      tickers.map((__, j) => {
        const denom = Math.sqrt(variances[i] * variances[j]);
        return denom > 0 ? cov[i][j] / denom : 0;
      })
    ),
    current: current
      ? describePortfolio(current.weights, means, cov, riskFreeRatePct, at.length, basis)
      : null,
    riskFreeRatePct,
    expected: {
      mode: returnMode,
      anchorPct,
      historyWeight: returnMode === 'history' ? 1 : returnMode === 'equal' ? 0 : historyWeight(equivalentTradingDays),
      perAssetPct: expectedPct
    }
  };

  return {
    tickers,
    points,
    frontier: optimum.frontier.map(toPoint),
    cap: optimum.cap,
    model: { mu, cov: covAnnual, returnSeries, periodsPerYear: periods },
    maxSharpe,
    minVol,
    current,
    dataPoints,
    breakdown
  };
}
