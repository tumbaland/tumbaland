// A plan for the next years, month by month: what comes in, what goes out, and
// where the difference ends up. Everything is in today's money, so returns are
// real (after inflation) and a figure ten years out means what it would buy now.
//
// The question it answers is not "what does a portfolio grow to" but "given the
// income I expect, the buffer I keep and the way I spend, when can I stop
// depending on a salary, and what happens in the gap between two incomes".

export interface PlanInputs {
  /** Today's balances. Cash is the buffer; funds are what can be sold; pensions are locked. */
  cash: number;
  funds: number;
  pensions: number;
  /** Monthly spending, and travel or one-offs spread over the year on top of it. */
  spending: number;
  extraYearly: number;
  /** Take-home pay per month while the current income lasts. */
  takeHomeNow: number;
  /** Whole months the current income still runs for. Infinity when it does not end. */
  incomeMonths: number;
  /** Months with no income between the two, such as between grants. */
  gapMonths: number;
  /** Take-home per month once the next income starts, part-time work included. */
  takeHomeAfter: number;
  /** Per month, out of take-home into pensions. Stops when there is no income. */
  pensionContribution: number;
  /** Cash to keep, in months of spending. */
  bufferMonths: number;
  /** Fill the buffer before putting anything into funds. */
  fillBufferFirst: boolean;
  years: number;
  /** Share of the funds that can be lived on each year, for the independence target. */
  withdrawalRatePct: number;
}

export interface PlanRun {
  cash: number[];
  funds: number[];
  pensions: number[];
  /** Cash and funds together: what can be reached before pension age. */
  accessible: number[];
  /** First month the accessible money covers the independence target, or null. */
  independenceMonth: number | null;
  /** Funds ran out and the plan was paying for life from nothing. */
  shortfallMonth: number | null;
  /** The month the current income stops, for marking the chart. */
  incomeEndsAt: number | null;
}

export const MONTHS_PER_YEAR = 12;

/** What the money has to be worth to live on its own: a year of spending over the withdrawal rate. */
export function independenceTarget(p: PlanInputs): number {
  const rate = p.withdrawalRatePct / 100;
  return rate > 0 ? (p.spending * MONTHS_PER_YEAR + p.extraYearly) / rate : Infinity;
}

/** Take-home in a given month: the current income, then the gap, then the next income. */
export function incomeIn(month: number, p: PlanInputs): number {
  if (month < p.incomeMonths) return p.takeHomeNow;
  if (month < p.incomeMonths + p.gapMonths) return 0;
  return p.takeHomeAfter;
}

/** Monthly return on a yearly rate, compounding. */
const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / MONTHS_PER_YEAR) - 1;

/**
 * Run the plan. `returnFor(month)` gives that month's return on funds and
 * pensions as a fraction, so the same engine serves a steady rate and a random
 * path.
 */
export function runPlan(p: PlanInputs, returnFor: (month: number) => number): PlanRun {
  const months = Math.round(p.years * MONTHS_PER_YEAR);
  const bufferTarget = p.bufferMonths * p.spending;
  const target = independenceTarget(p);

  let cash = p.cash;
  let funds = p.funds;
  let pensions = p.pensions;

  const run: PlanRun = {
    cash: [cash],
    funds: [funds],
    pensions: [pensions],
    accessible: [cash + funds],
    independenceMonth: cash + funds >= target ? 0 : null,
    shortfallMonth: null,
    incomeEndsAt: Number.isFinite(p.incomeMonths) && p.incomeMonths <= months ? p.incomeMonths : null
  };

  for (let m = 0; m < months; m++) {
    const r = returnFor(m);
    funds *= 1 + r;
    pensions *= 1 + r;

    const income = incomeIn(m, p);
    const toPension = income > 0 ? Math.min(p.pensionContribution, income) : 0;
    pensions += toPension;

    const net = income - toPension - p.spending - p.extraYearly / MONTHS_PER_YEAR;

    if (net >= 0) {
      const toBuffer = p.fillBufferFirst ? Math.min(net, Math.max(0, bufferTarget - cash)) : 0;
      cash += toBuffer;
      funds += net - toBuffer;
    } else {
      // A shortfall is paid from cash first, then from funds, which is what the
      // buffer is for.
      const fromCash = Math.min(cash, -net);
      cash -= fromCash;
      funds -= -net - fromCash;
    }

    if (funds < 0) {
      if (run.shortfallMonth === null) run.shortfallMonth = m + 1;
      funds = 0;
    }

    run.cash.push(cash);
    run.funds.push(funds);
    run.pensions.push(pensions);
    run.accessible.push(cash + funds);
    if (run.independenceMonth === null && cash + funds >= target) run.independenceMonth = m + 1;
  }

  return run;
}

/** A plan at a steady real return, in percent a year. */
export const runSteady = (p: PlanInputs, annualReturnPct: number): PlanRun => {
  const r = monthlyRate(annualReturnPct);
  return runPlan(p, () => r);
};

// ---- random paths ------------------------------------------------------

/** A small seeded generator, so a result does not change when nothing else did. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal from two uniforms (Box-Muller). */
const normal = (random: () => number) => {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
};

export interface RandomResult {
  /** Accessible money at the end of each year, for each percentile. */
  years: number[];
  p10: number[];
  p50: number[];
  p90: number[];
  /** Share of paths that reached the independence target by the end, 0 to 1. */
  reachedTarget: number;
  /** Share of paths in which funds ran out. */
  ranOut: number;
}

const percentile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

/**
 * Many random paths with the same expected return. Returns are lognormal, with
 * the drift set so the average yearly return is the one asked for, which is what
 * makes a volatile path land below a steady one at the median.
 */
export function runRandom(
  p: PlanInputs,
  annualReturnPct: number,
  annualVolPct: number,
  simulations = 500,
  seed = 1
): RandomResult {
  const random = seededRandom(seed);
  const sigma = annualVolPct / 100;
  const logDrift = Math.log(1 + annualReturnPct / 100) - (sigma * sigma) / 2;
  const monthlyDrift = logDrift / MONTHS_PER_YEAR;
  const monthlySigma = sigma / Math.sqrt(MONTHS_PER_YEAR);

  const yearCount = Math.round(p.years);
  const byYear: number[][] = Array.from({ length: yearCount + 1 }, () => []);
  let reached = 0;
  let ranOut = 0;

  for (let s = 0; s < simulations; s++) {
    const run = runPlan(p, () => Math.exp(monthlyDrift + monthlySigma * normal(random)) - 1);
    for (let y = 0; y <= yearCount; y++) byYear[y].push(run.accessible[y * MONTHS_PER_YEAR] ?? run.accessible[run.accessible.length - 1]);
    if (run.independenceMonth !== null) reached++;
    if (run.shortfallMonth !== null) ranOut++;
  }

  const sorted = byYear.map((values) => [...values].sort((a, b) => a - b));
  return {
    years: sorted.map((_, y) => y),
    p10: sorted.map((v) => percentile(v, 0.1)),
    p50: sorted.map((v) => percentile(v, 0.5)),
    p90: sorted.map((v) => percentile(v, 0.9)),
    reachedTarget: reached / simulations,
    ranOut: ranOut / simulations
  };
}

// ---- reading a run -----------------------------------------------------

/** Whole months from `from` to the end of `to`'s month, counting both, never below zero. */
export function monthsThrough(from: Date, to: Date): number {
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1);
}

/** Cash as months of spending, which is how a buffer is thought about. */
export const bufferMonthsOf = (cash: number, spending: number) => (spending > 0 ? cash / spending : 0);

export interface WhatIfRow {
  takeHomeAfter: number;
  /** Per month once the next income starts: take-home less spending. */
  monthlySaving: number;
  accessibleAtEnd: number;
  independenceYears: number | null;
}

/** The same plan at other take-home levels, for "what if the part-time work pays more". */
export function whatIfTakeHome(p: PlanInputs, annualReturnPct: number, levels: number[]): WhatIfRow[] {
  return levels.map((takeHomeAfter) => {
    // With an income that never ends there is no "after", so the level is the
    // income itself.
    const varied = Number.isFinite(p.incomeMonths)
      ? { ...p, takeHomeAfter }
      : { ...p, takeHomeNow: takeHomeAfter, takeHomeAfter };
    const run = runSteady(varied, annualReturnPct);
    return {
      takeHomeAfter,
      monthlySaving: takeHomeAfter - p.spending - p.extraYearly / MONTHS_PER_YEAR - Math.min(p.pensionContribution, takeHomeAfter),
      accessibleAtEnd: run.accessible[run.accessible.length - 1],
      independenceYears: run.independenceMonth === null ? null : run.independenceMonth / MONTHS_PER_YEAR
    };
  });
}
