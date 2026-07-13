// Long-horizon growth projection: a deterministic compound-growth path plus
// Monte Carlo percentile bands. Contributions and compounding are always
// monthly — the annual/monthly toggles of the old calculator collapsed into
// one model, and the distribution knobs into a fixed fat-tailed Student's t.

export interface ProjectionParams {
  startingCapital: number;
  monthlyContribution: number;
  years: number;
  expectedAnnualReturnPct: number; // arithmetic annual return, %
  annualVolatilityPct: number; // annualized standard deviation, %
  annualInflationPct: number;
  annualFeePct: number;
}

export interface YearlyProjection {
  year: number;
  moneyInvested: number;
  gainFromMarket: number;
  portfolioTotalValue: number;
  inflationAdjustedValue: number;
}

export interface McBands {
  years: number[];
  p10: number[];
  p50: number[];
  p90: number[];
}

export const SCENARIO_PRESETS = {
  conservative: { growth: 6, volatility: 10 },
  base: { growth: 8, volatility: 15 },
  aggressive: { growth: 12, volatility: 25 }
} as const;

export type ScenarioPreset = keyof typeof SCENARIO_PRESETS;

export function projectDeterministic(p: ProjectionParams): YearlyProjection[] {
  const netAnnual = (1 + p.expectedAnnualReturnPct / 100) * (1 - p.annualFeePct / 100) - 1;
  const netMonthly = Math.pow(1 + netAnnual, 1 / 12) - 1;
  const rows: YearlyProjection[] = [];
  let invested = p.startingCapital;
  let value = p.startingCapital;
  for (let m = 1; m <= p.years * 12; m++) {
    invested += p.monthlyContribution;
    value = (value + p.monthlyContribution) * (1 + netMonthly);
    if (m % 12 === 0) {
      const year = m / 12;
      rows.push({
        year,
        moneyInvested: invested,
        gainFromMarket: value - invested,
        portfolioTotalValue: value,
        inflationAdjustedValue: value / Math.pow(1 + p.annualInflationPct / 100, year)
      });
    }
  }
  return rows;
}

export function yearsToGoal(rows: YearlyProjection[], goal: number): number | undefined {
  return rows.find(r => r.portfolioTotalValue >= goal)?.year;
}

// An annualized mean return estimated from a short price window is mostly
// noise (a few bull months extrapolate to absurd decade-long projections), so
// blend it toward a long-run equity anchor, trusting history more as the
// sample grows: ~3 years of data earns it equal weight with the anchor.
export const LONG_RUN_RETURN_PCT = 8;
const ANCHOR_DAYS = 756; // 3 years of trading days

export function shrinkExpectedReturn(
  histPct: number,
  sampleDays: number,
  anchorPct: number = LONG_RUN_RETURN_PCT
): number {
  const days = Math.max(0, sampleDays);
  const w = days / (days + ANCHOR_DAYS);
  return w * histPct + (1 - w) * anchorPct;
}

function randn(): number {
  // Box-Muller
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

const T_DEGREES = 5;
// Var(t_df) = df / (df - 2); rescale so shocks have unit variance and the
// stated volatility stays honest despite the fat tails.
const T_SCALE = Math.sqrt((T_DEGREES - 2) / T_DEGREES);

function tShock(): number {
  const z = randn();
  let chi2 = 0;
  for (let i = 0; i < T_DEGREES; i++) {
    const zi = randn();
    chi2 += zi * zi;
  }
  return (z / Math.sqrt(chi2 / T_DEGREES)) * T_SCALE;
}

function percentileSorted(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function runMonteCarloBands(p: ProjectionParams, simulations = 1000): McBands {
  const months = p.years * 12;
  const mu = Math.max(-0.99, p.expectedAnnualReturnPct / 100);
  const sigma = Math.max(0, p.annualVolatilityPct) / 100;
  const sigmaM = sigma / Math.sqrt(12);
  // Calibrate the log drift so the simulation's *mean* path compounds at
  // exactly (1+mu)^t, matching the deterministic projection; the median then
  // sits below it by the usual volatility drag instead of drifting above it.
  const driftM = Math.log(1 + mu) / 12 - 0.5 * sigmaM * sigmaM;
  const feeM = Math.pow(1 - p.annualFeePct / 100, 1 / 12);

  const endOfYear: number[][] = Array.from({ length: p.years }, () => new Array(simulations));
  for (let s = 0; s < simulations; s++) {
    let value = p.startingCapital;
    for (let m = 1; m <= months; m++) {
      value += p.monthlyContribution;
      value *= Math.exp(driftM + sigmaM * (sigma > 0 ? tShock() : 0)) * feeM;
      if (m % 12 === 0) endOfYear[m / 12 - 1][s] = value;
    }
  }

  const years: number[] = [];
  const p10: number[] = [];
  const p50: number[] = [];
  const p90: number[] = [];
  for (let y = 1; y <= p.years; y++) {
    const vals = endOfYear[y - 1].sort((a, b) => a - b);
    years.push(y);
    p10.push(percentileSorted(vals, 0.1));
    p50.push(percentileSorted(vals, 0.5));
    p90.push(percentileSorted(vals, 0.9));
  }
  return { years, p10, p50, p90 };
}
