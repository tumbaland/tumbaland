// Long-only mean-variance optimization, solved rather than sampled.
//
// The frontier used to be found by scoring a couple of thousand random weight
// vectors and keeping the best. With more than three or four holdings random
// weights almost never land on the edge, so the "efficient" portfolios were only
// the best of a cloud, not the frontier. Here each point is the answer to a small
// convex problem:
//
//     maximize  μᵀw − (λ/2)·wᵀΣw     subject to  Σw = 1,  0 ≤ wᵢ ≤ cap
//
// Sweeping the risk aversion λ from "ignore risk" to "only risk" traces the whole
// frontier, and the cap is what keeps it from putting everything in one holding.
//
// Units throughout: returns and covariances are annual decimals (0.06, not 6).

/** How the long-run anchor is blended with what history says. */
export type ReturnMode = 'history' | 'shrunk' | 'equal';

/**
 * Where a return estimate stops being trusted. History and the anchor carry equal
 * weight at three years of trading days.
 */
export const ANCHOR_DAYS = 756;

/** What every holding is assumed to earn before looking at its own past, % a year. */
export const DEFAULT_ANCHOR_PCT = 6;

/**
 * Blend one history-derived return toward a long-run anchor, trusting history
 * more as the sample grows. A few good months extrapolate to absurd decades, and
 * mean-variance optimization is the best known way to act on that mistake: it
 * puts the money wherever the noise happened to be highest.
 */
export function shrinkExpectedReturn(histPct: number, sampleDays: number, anchorPct: number = DEFAULT_ANCHOR_PCT): number {
  const w = sampleDays / (sampleDays + ANCHOR_DAYS);
  return w * histPct + (1 - w) * anchorPct;
}

/** Weight history carries at a given sample size, 0 to 1. */
export const historyWeight = (sampleDays: number) => sampleDays / (sampleDays + ANCHOR_DAYS);

/** The expected return of each holding under a mode, in % a year. */
export function expectedReturnsPct(
  histPct: number[],
  mode: ReturnMode,
  sampleDays: number,
  anchorPct: number = DEFAULT_ANCHOR_PCT
): number[] {
  if (mode === 'history') return [...histPct];
  if (mode === 'equal') return histPct.map(() => anchorPct);
  return histPct.map((h) => shrinkExpectedReturn(h, sampleDays, anchorPct));
}

// ---- the solver ---------------------------------------------------------

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * The closest weights to `v` that sum to one, with each between zero and `cap`.
 * Found by shifting every entry by the same amount until the clamped sum is one,
 * which is monotone in the shift and so yields to bisection.
 */
export function projectCappedSimplex(v: number[], cap: number): number[] {
  let lo = Math.min(...v) - cap;
  let hi = Math.max(...v);
  for (let i = 0; i < 80; i++) {
    const tau = (lo + hi) / 2;
    const sum = v.reduce((s, x) => s + clamp(x - tau, 0, cap), 0);
    if (sum > 1) lo = tau;
    else hi = tau;
  }
  const tau = (lo + hi) / 2;
  const w = v.map((x) => clamp(x - tau, 0, cap));
  // Absorb the last of the bisection error so the weights sum to one exactly.
  const total = w.reduce((s, x) => s + x, 0);
  return total > 0 ? w.map((x) => x / total) : w;
}

const multiply = (cov: number[][], w: number[]) => cov.map((row) => row.reduce((s, c, j) => s + c * w[j], 0));

/** A bound on the largest eigenvalue: the biggest absolute row sum. */
const lipschitz = (cov: number[][]) => Math.max(1e-12, ...cov.map((row) => row.reduce((s, c) => s + Math.abs(c), 0)));

/**
 * One point of the frontier: the weights that maximize μᵀw − (λ/2)·wᵀΣw under
 * the cap. Accelerated projected gradient; the problem is a small convex
 * quadratic, so this converges in a few hundred steps for a handful of holdings.
 */
export function solveMeanVariance(mu: number[], cov: number[][], lambda: number, cap: number, iterations = 1500): number[] {
  const n = mu.length;
  const step = 1 / (Math.max(lambda, 1e-9) * lipschitz(cov));
  let x: number[] = Array(n).fill(1 / n);
  let y = x;
  let t = 1;

  for (let k = 0; k < iterations; k++) {
    const grad = multiply(cov, y).map((g, i) => lambda * g - mu[i]);
    const next = projectCappedSimplex(y.map((yi, i) => yi - step * grad[i]), cap);
    const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
    const momentum = (t - 1) / tNext;
    y = next.map((xi, i) => xi + momentum * (xi - x[i]));

    const moved = next.reduce((m, xi, i) => Math.max(m, Math.abs(xi - x[i])), 0);
    x = next;
    t = tNext;
    if (moved < 1e-11) break;
  }
  return x;
}

/** The highest-return weights allowed: fill the best holdings to the cap, in order. */
export function maxReturnWeights(mu: number[], cap: number): number[] {
  const order = mu.map((m, i) => [m, i] as const).sort((a, b) => b[0] - a[0]);
  const w: number[] = Array(mu.length).fill(0);
  let left = 1;
  for (const [, i] of order) {
    const take = Math.min(cap, left);
    w[i] = take;
    left -= take;
    if (left <= 1e-12) break;
  }
  return w;
}

export interface Stats {
  /** Annual, decimal. */
  ret: number;
  vol: number;
  sharpe: number;
}

export function statsOf(w: number[], mu: number[], cov: number[][], rf: number): Stats {
  const ret = w.reduce((s, wi, i) => s + wi * mu[i], 0);
  const cw = multiply(cov, w);
  const variance = w.reduce((s, wi, i) => s + wi * cw[i], 0);
  const vol = Math.sqrt(Math.max(0, variance));
  return { ret, vol, sharpe: vol > 0 ? (ret - rf) / vol : 0 };
}

export interface OptimalPortfolio extends Stats {
  weights: number[];
}

export interface Optimization {
  /** Efficient portfolios from least to most risk, return rising with it. */
  frontier: OptimalPortfolio[];
  minVol: OptimalPortfolio;
  maxSharpe: OptimalPortfolio;
  /** The cap actually applied, which cannot be below an equal split. */
  cap: number;
}

const portfolio = (w: number[], mu: number[], cov: number[][], rf: number): OptimalPortfolio => ({
  weights: w,
  ...statsOf(w, mu, cov, rf)
});

/**
 * The efficient frontier, the minimum-risk portfolio and the best Sharpe ratio,
 * all long-only and under the cap.
 */
export function optimize(mu: number[], cov: number[][], rf: number, capWanted = 1, points = 60): Optimization {
  const n = mu.length;
  // A cap below an equal split leaves no way to sum to one.
  const cap = Math.min(1, Math.max(capWanted, 1 / n));

  const solve = (lambda: number) => portfolio(solveMeanVariance(mu, cov, lambda, cap), mu, cov, rf);

  const minVol = solve(1e6);
  const maxReturn = portfolio(maxReturnWeights(mu, cap), mu, cov, rf);

  // Risk aversion on a log scale, from "return only" to "risk only".
  const lambdas = Array.from({ length: points }, (_, i) => Math.pow(10, -2 + (i / (points - 1)) * 7));
  const swept = [maxReturn, ...lambdas.map(solve), minVol];

  // Keep only what is efficient: sorted by risk, return must keep rising.
  const sorted = swept.sort((a, b) => a.vol - b.vol || b.ret - a.ret);
  const frontier: OptimalPortfolio[] = [];
  for (const p of sorted) {
    const last = frontier[frontier.length - 1];
    if (!last || p.ret > last.ret + 1e-9) {
      // A point at (nearly) the same risk as the last replaces it only if it earns more.
      if (last && p.vol - last.vol < 1e-9) frontier[frontier.length - 1] = p;
      else frontier.push(p);
    }
  }

  // Best Sharpe: the best swept point, then refined. Sharpe rises and then falls
  // as risk aversion grows, so golden-section search on log λ finds the peak.
  let best = frontier.reduce((b, p) => (p.sharpe > b.sharpe ? p : b), frontier[0]);
  {
    let lo = -2;
    let hi = 5;
    const sharpeAt = (logLambda: number) => solve(Math.pow(10, logLambda));
    const phi = (Math.sqrt(5) - 1) / 2;
    let a = hi - phi * (hi - lo);
    let b = lo + phi * (hi - lo);
    let fa = sharpeAt(a);
    let fb = sharpeAt(b);
    for (let i = 0; i < 40; i++) {
      if (fa.sharpe > fb.sharpe) {
        hi = b; b = a; fb = fa; a = hi - phi * (hi - lo); fa = sharpeAt(a);
      } else {
        lo = a; a = b; fa = fb; b = lo + phi * (hi - lo); fb = sharpeAt(b);
      }
    }
    const refined = fa.sharpe > fb.sharpe ? fa : fb;
    if (refined.sharpe > best.sharpe) best = refined;
  }

  return { frontier, minVol, maxSharpe: best, cap };
}

// ---- reading a frontier ------------------------------------------------

/** The most a frontier earns at or below this risk, interpolating between its points. */
export function frontierReturnAtVol(frontier: { ret: number; vol: number }[], vol: number): number | null {
  if (frontier.length === 0 || vol < frontier[0].vol) return null;
  for (let i = 1; i < frontier.length; i++) {
    if (vol <= frontier[i].vol) {
      const a = frontier[i - 1];
      const b = frontier[i];
      const t = b.vol > a.vol ? (vol - a.vol) / (b.vol - a.vol) : 0;
      return a.ret + t * (b.ret - a.ret);
    }
  }
  return frontier[frontier.length - 1].ret;
}

/** The least risk a frontier needs to earn this return, interpolating. */
export function frontierVolAtReturn(frontier: { ret: number; vol: number }[], ret: number): number | null {
  if (frontier.length === 0 || ret > frontier[frontier.length - 1].ret) return null;
  if (ret <= frontier[0].ret) return frontier[0].vol;
  for (let i = 1; i < frontier.length; i++) {
    if (ret <= frontier[i].ret) {
      const a = frontier[i - 1];
      const b = frontier[i];
      const t = b.ret > a.ret ? (ret - a.ret) / (b.ret - a.ret) : 0;
      return a.vol + t * (b.vol - a.vol);
    }
  }
  return null;
}

/** The frontier portfolio at a chosen risk: the best return available at or below it. */
export function frontierPointAtVol<T extends { vol: number }>(frontier: T[], vol: number): T | null {
  let chosen: T | null = null;
  for (const p of frontier) if (p.vol <= vol + 1e-12) chosen = p;
  return chosen ?? frontier[0] ?? null;
}

// ---- what a portfolio is made of ---------------------------------------

/**
 * Each holding's share of the portfolio's risk (they sum to one). A holding can
 * be a third of the money and half the risk, and the weights alone never show it.
 */
export function riskContributions(w: number[], cov: number[][]): number[] {
  const cw = multiply(cov, w);
  const variance = w.reduce((s, wi, i) => s + wi * cw[i], 0);
  return variance > 0 ? w.map((wi, i) => (wi * cw[i]) / variance) : w.map(() => 0);
}

/** How many holdings carry a meaningful share of the money. */
export const holdingsUsed = (w: number[], minShare = 0.01) => w.filter((x) => x > minShare).length;

/** How many equally sized holdings the portfolio behaves like, 1 to n. */
export const effectiveHoldings = (w: number[]) => {
  const sumSquares = w.reduce((s, x) => s + x * x, 0);
  return sumSquares > 0 ? 1 / sumSquares : 0;
};

// ---- what it would have been through ----------------------------------

/** Period returns of a portfolio held at fixed weights, rebalanced every period. */
export function portfolioReturns(w: number[], returnSeries: number[][]): number[] {
  const length = returnSeries[0]?.length ?? 0;
  return Array.from({ length }, (_, t) => w.reduce((s, wi, i) => s + wi * returnSeries[i][t], 0));
}

/** The worst fall from a peak, as a negative percent. */
export function maxDrawdownPct(returns: number[]): number {
  let value = 1;
  let peak = 1;
  let worst = 0;
  for (const r of returns) {
    value *= 1 + r;
    peak = Math.max(peak, value);
    worst = Math.min(worst, value / peak - 1);
  }
  return worst * 100;
}

/** The worst return over any run of `window` periods, or null if the history is shorter. */
export function worstWindowPct(returns: number[], window: number): number | null {
  if (window < 1 || returns.length < window) return null;
  let worst = Infinity;
  let value = 1;
  const growth = returns.map((r) => 1 + r);
  for (let i = 0; i < growth.length; i++) {
    value *= growth[i];
    if (i >= window) value /= growth[i - window];
    if (i >= window - 1) worst = Math.min(worst, value - 1);
  }
  return worst * 100;
}

/**
 * Fill the underweights with new money, never selling: the purchase that leaves
 * the portfolio closest to the target. Money is poured into whichever holding is
 * furthest below its target until the levels meet, then spread by target weight.
 */
export function newMoneyPlan(currentValues: number[], targetWeights: number[], newMoney: number): number[] {
  const n = currentValues.length;
  const total = currentValues.reduce((s, v) => s + v, 0) + newMoney;
  if (newMoney <= 0) return Array(n).fill(0);

  // The shortfall of each holding against the target at the new total.
  const shortfall = currentValues.map((v, i) => Math.max(0, targetWeights[i] * total - v));
  const needed = shortfall.reduce((s, x) => s + x, 0);
  if (needed <= 0) return targetWeights.map((w) => w * newMoney);
  if (needed <= newMoney) {
    // Everything below target can be brought to it, with the rest spread by target weight.
    const rest = newMoney - needed;
    return shortfall.map((x, i) => x + targetWeights[i] * rest);
  }
  // Not enough to close every gap: share it in proportion to how far each is behind.
  return shortfall.map((x) => (x / needed) * newMoney);
}
