// Core portfolio math utilities for mean-variance optimization (unconstrained)
// All returns are decimals (e.g., 0.10 for 10%) and covariances are annualized.

export type Matrix = number[][];

export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function covariance(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n <= 1) return 0;
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += (x[i] - mx) * (y[i] - my);
  return sum / (n - 1);
}

export function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

export function matVecMul(mat: Matrix, vec: number[]): number[] {
  return mat.map(row => row.reduce((s, v, j) => s + v * vec[j], 0));
}

export function invertMatrix(a: Matrix): Matrix | null {
  const n = a.length;
  const A = a.map(row => row.slice());
  const I = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    let maxVal = Math.abs(A[i][i]);
    for (let r = i + 1; r < n; r++) {
      const val = Math.abs(A[r][i]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }
    if (maxVal < 1e-12) return null; // Singular

    if (maxRow !== i) {
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [I[i], I[maxRow]] = [I[maxRow], I[i]];
    }

    const pivot = A[i][i];
    for (let j = 0; j < n; j++) {
      A[i][j] /= pivot;
      I[i][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const factor = A[r][i];
      if (Math.abs(factor) < 1e-20) continue;
      for (let c = 0; c < n; c++) {
        A[r][c] -= factor * A[i][c];
        I[r][c] -= factor * I[i][c];
      }
    }
  }
  return I;
}

export function buildMuSigma(dailyReturnsByTicker: Record<string, number[]>, tickers: string[]) {
  const mu = tickers.map(t => mean(dailyReturnsByTicker[t] || []) * 252);
  const n = tickers.length;
  const Sigma: Matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => covariance(dailyReturnsByTicker[tickers[i]] || [], dailyReturnsByTicker[tickers[j]] || []) * 252)
  );
  return { mu, Sigma };
}

export function weightsMinVariance(Sigma: Matrix): number[] | null {
  const inv = invertMatrix(Sigma);
  if (!inv) return null;
  const n = Sigma.length;
  const ones = Array(n).fill(1);
  const z = matVecMul(inv, ones);
  const s = z.reduce((a, b) => a + b, 0) || 1;
  return z.map(v => v / s);
}

export function weightsTangency(mu: number[], Sigma: Matrix, rf: number): number[] | null {
  const inv = invertMatrix(Sigma);
  if (!inv) return null;
  const n = mu.length;
  const ones = Array(n).fill(1);
  const excess = mu.map(m => m - rf);
  const z = matVecMul(inv, excess);
  const s = dot(ones, z) || 1;
  return z.map(v => v / s);
}

export function weightsTargetReturn(mu: number[], Sigma: Matrix, target: number): number[] | null {
  const inv = invertMatrix(Sigma);
  if (!inv) return null;
  // A = 1' Σ^-1 1, B = 1' Σ^-1 μ, C = μ' Σ^-1 μ
  const ones = Array(mu.length).fill(1);
  const inv1 = matVecMul(inv, ones);
  const invMu = matVecMul(inv, mu);
  const A = dot(ones, inv1);
  const B = dot(ones, invMu);
  const C = dot(mu, invMu);
  const D = A * C - B * B;
  if (Math.abs(D) < 1e-12) return null;
  // Solve [A B; B C] * [λ; γ] = [1; target]
  const lambda = (C * 1 - B * target) / D;
  const gamma = (A * target - B * 1) / D;
  // w = Σ^-1 (λ 1 + γ μ)
  const combo = inv1.map((v, i) => lambda * v + gamma * invMu[i]);
  return combo;
}

export function portfolioVariance(w: number[], Sigma: Matrix): number {
  let v = 0;
  for (let i = 0; i < w.length; i++) {
    for (let j = 0; j < w.length; j++) {
      v += w[i] * Sigma[i][j] * w[j];
    }
  }
  return v;
}

export function portfolioReturn(w: number[], mu: number[]): number {
  return dot(w, mu);
}

export function computeEfficientFrontierUnconstrained(mu: number[], Sigma: Matrix, numPoints = 100): Array<{ return: number; risk: number; weights?: number[] }> {
  const minMu = Math.min(...mu);
  const maxMu = Math.max(...mu);
  const rangeMin = minMu * 0.9; // extend a bit beyond observed
  const rangeMax = maxMu * 1.1;
  const points: Array<{ return: number; risk: number; weights?: number[] }> = [];
  for (let i = 0; i < numPoints; i++) {
    const target = rangeMin + (i / (numPoints - 1)) * (rangeMax - rangeMin);
    const w = weightsTargetReturn(mu, Sigma, target);
    if (!w) continue;
    const r = portfolioReturn(w, mu);
    const v = Math.max(0, portfolioVariance(w, Sigma));
    points.push({ return: r * 100, risk: Math.sqrt(v) * 100, weights: w });
  }
  // Keep only the upper (efficient) branch: increasing return with risk
  const sorted = points.sort((a, b) => a.risk - b.risk);
  const efficient: typeof points = [];
  let maxR = -Infinity;
  for (const p of sorted) {
    if (p.return > maxR) {
      efficient.push(p);
      maxR = p.return;
    }
  }
  return efficient;
}

// Simple projection onto the probability simplex (w >= 0, sum w = 1)
export function projectToSimplex(v: number[]): number[] {
  const n = v.length;
  const u = [...v].sort((a, b) => b - a);
  let rho = -1;
  let cumsum = 0;
  for (let i = 0; i < n; i++) {
    cumsum += u[i];
    if (u[i] + (1 - cumsum) / (i + 1) > 0) rho = i;
  }
  const theta = (u.slice(0, rho + 1).reduce((s, x) => s + x, 0) - 1) / (rho + 1);
  return v.map(x => Math.max(0, x - theta));
}

// Constrained (no-shorting) efficient frontier via projected gradient descent.
// Minimizes w'Σw - alpha * (w'μ) for a sweep of alpha, projecting onto simplex after each step.
// Returns annualized percent values for return and risk, like the unconstrained version.
export function computeEfficientFrontierNoShort(
  mu: number[],
  Sigma: Matrix,
  numPoints = 60,
  iters = 400,
  lr = 0.02
): Array<{ return: number; risk: number; weights?: number[] }> {
  const n = mu.length;
  if (n === 0) return [];
  let w = Array(n).fill(1 / n);

  // Alpha controls trade-off between minimizing variance and maximizing return.
  // Use a range based on μ scale to traverse the frontier.
  const muScale = Math.max(1e-6, Math.max(...mu.map(m => Math.abs(m))));
  const alphaMax = 80 / muScale; // heuristic; larger when mu small

  const points: Array<{ return: number; risk: number; weights?: number[] }> = [];
  for (let k = 0; k < numPoints; k++) {
    const alpha = (k / (numPoints - 1)) * alphaMax;
    // warm start from previous w for smooth path
    for (let t = 0; t < iters; t++) {
      // grad = 2 Σ w - alpha μ
      const SigmaW = matVecMul(Sigma, w);
      const grad = SigmaW.map((v, i) => 2 * v - alpha * mu[i]);
      // gradient step and project to simplex
      w = w.map((wi, i) => wi - lr * grad[i]);
      w = projectToSimplex(w);
    }
    const r = portfolioReturn(w, mu);
    const v = Math.max(0, portfolioVariance(w, Sigma));
    points.push({ return: r * 100, risk: Math.sqrt(v) * 100, weights: [...w] });
  }

  // Keep upper envelope
  const sorted = points.sort((a, b) => a.risk - b.risk);
  const efficient: typeof points = [];
  let maxR = -Infinity;
  for (const p of sorted) {
    if (p.return > maxR) {
      efficient.push(p);
      maxR = p.return;
    }
  }
  return efficient;
}
