// Random-portfolio Monte Carlo over historical daily returns: samples random
// weight vectors on the simplex and scores each portfolio by annualized
// return/volatility/Sharpe. Extracted from the old PortfolioOptimizer page so
// the planner page can stay lean and the math is testable on its own.
import { mean, covariance } from './portfolioMath';

export const TRADING_DAYS = 252;

export interface SimPoint {
  ret: number; // annualized return, %
  vol: number; // annualized volatility, %
  sharpe: number;
  weights: number[];
}

export interface FrontierSim {
  tickers: string[];
  points: SimPoint[];
  maxSharpe: SimPoint;
  minVol: SimPoint;
  current: SimPoint | null;
  dataPoints: number; // number of trading days used
}

export function dailyReturns(prices: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < prices.length; i++) r.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  return r;
}

export function portfolioStats(
  weights: number[],
  means: number[],
  cov: number[][],
  rfDaily: number
): { ret: number; vol: number; sharpe: number } {
  const dailyRet = weights.reduce((s, w, i) => s + w * means[i], 0);
  let dailyVar = 0;
  for (let i = 0; i < weights.length; i++)
    for (let j = 0; j < weights.length; j++)
      dailyVar += weights[i] * weights[j] * cov[i][j];
  const ret = dailyRet * TRADING_DAYS * 100;
  const vol = Math.sqrt(Math.max(0, dailyVar * TRADING_DAYS)) * 100;
  const sharpe = vol > 0 ? (ret - rfDaily * TRADING_DAYS * 100) / vol : 0;
  return { ret, vol, sharpe };
}

// Dirichlet-like random weights (exponential trick for uniform distribution on simplex)
export function randomWeights(n: number): number[] {
  const raw = Array.from({ length: n }, () => -Math.log(Math.random() + 1e-10));
  const sum = raw.reduce((s, x) => s + x, 0);
  return raw.map(x => x / sum);
}

export function runFrontierSimulation(opts: {
  pricesByTicker: Record<string, number[]>;
  quantityByTicker: Record<string, number>;
  riskFreeRatePct: number;
  simulations?: number;
}): FrontierSim | null {
  const { pricesByTicker, quantityByTicker, riskFreeRatePct, simulations = 2000 } = opts;
  const tickers = Object.keys(pricesByTicker);
  if (tickers.length < 2) return null;

  const returnSeries = tickers.map(t => dailyReturns(pricesByTicker[t]));
  const means = returnSeries.map(r => mean(r));
  const cov = tickers.map((_, i) => tickers.map((_, j) => covariance(returnSeries[i], returnSeries[j])));
  const rfDaily = riskFreeRatePct / 100 / TRADING_DAYS;

  const points: SimPoint[] = [];
  for (let s = 0; s < simulations; s++) {
    const w = randomWeights(tickers.length);
    points.push({ ...portfolioStats(w, means, cov, rfDaily), weights: w });
  }

  const maxSharpe = points.reduce((b, p) => (p.sharpe > b.sharpe ? p : b), points[0]);
  const minVol = points.reduce((b, p) => (p.vol < b.vol ? p : b), points[0]);

  const values = tickers.map(t => {
    const prices = pricesByTicker[t];
    return (quantityByTicker[t] ?? 0) * prices[prices.length - 1];
  });
  const totalVal = values.reduce((s, v) => s + v, 0);

  let current: SimPoint | null = null;
  if (totalVal > 0) {
    const w = values.map(v => v / totalVal);
    current = { ...portfolioStats(w, means, cov, rfDaily), weights: w };
  }

  const dataPoints = Math.min(...returnSeries.map(r => r.length));
  return { tickers, points, maxSharpe, minVol, current, dataPoints };
}
