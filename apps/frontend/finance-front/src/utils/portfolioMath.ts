// Mean and covariance of return series, the two statistics the planner's
// simulation (frontierSim) is built from. Returns are decimals (0.10 for 10%).

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
