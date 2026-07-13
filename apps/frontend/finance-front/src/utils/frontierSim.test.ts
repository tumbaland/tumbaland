import {
  TRADING_DAYS,
  dailyReturns,
  portfolioStats,
  randomWeights,
  runFrontierSimulation
} from './frontierSim';

describe('dailyReturns', () => {
  it('computes simple returns between consecutive prices', () => {
    expect(dailyReturns([100, 110, 99])).toEqual([0.1, -0.1]);
  });

  it('returns an empty array for fewer than 2 prices', () => {
    expect(dailyReturns([100])).toEqual([]);
  });
});

describe('randomWeights', () => {
  it('produces non-negative weights that sum to 1', () => {
    for (let i = 0; i < 20; i++) {
      const w = randomWeights(4);
      expect(w).toHaveLength(4);
      w.forEach(x => expect(x).toBeGreaterThanOrEqual(0));
      expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
    }
  });
});

describe('portfolioStats', () => {
  it('annualizes a single-asset portfolio', () => {
    const means = [0.001, 0.002];
    const cov = [
      [0.0001, 0],
      [0, 0.0004]
    ];
    const stats = portfolioStats([1, 0], means, cov, 0);
    expect(stats.ret).toBeCloseTo(0.001 * TRADING_DAYS * 100, 8);
    expect(stats.vol).toBeCloseTo(Math.sqrt(0.0001 * TRADING_DAYS) * 100, 8);
    expect(stats.sharpe).toBeCloseTo(stats.ret / stats.vol, 8);
  });

  it('subtracts the risk-free rate in the Sharpe ratio', () => {
    const stats = portfolioStats([1], [0.001], [[0.0001]], 0.001);
    expect(stats.sharpe).toBeCloseTo(0, 8);
  });
});

function series(base: number, seed: number): number[] {
  const out: number[] = [];
  let price = base;
  for (let i = 0; i < 25; i++) {
    price *= 1 + (Math.sin(i + seed) * 0.01 + 0.001);
    out.push(price);
  }
  return out;
}

describe('runFrontierSimulation', () => {
  const pricesByTicker = { AAPL: series(150, 1), MSFT: series(300, 2) };
  const quantityByTicker = { AAPL: 10, MSFT: 5 };

  it('needs at least 2 tickers', () => {
    expect(
      runFrontierSimulation({ pricesByTicker: { AAPL: series(150, 1) }, quantityByTicker, riskFreeRatePct: 3 })
    ).toBeNull();
  });

  it('samples the requested number of portfolios and flags the extremes', () => {
    const sim = runFrontierSimulation({ pricesByTicker, quantityByTicker, riskFreeRatePct: 3, simulations: 200 })!;
    expect(sim.points).toHaveLength(200);
    expect(sim.tickers).toEqual(['AAPL', 'MSFT']);
    expect(sim.dataPoints).toBe(24);
    expect(Math.max(...sim.points.map(p => p.sharpe))).toBe(sim.maxSharpe.sharpe);
    expect(Math.min(...sim.points.map(p => p.vol))).toBe(sim.minVol.vol);
  });

  it('weights the current portfolio by holding value at the latest price', () => {
    const sim = runFrontierSimulation({ pricesByTicker, quantityByTicker, riskFreeRatePct: 3, simulations: 50 })!;
    const latest = (t: 'AAPL' | 'MSFT') => pricesByTicker[t][pricesByTicker[t].length - 1];
    const total = 10 * latest('AAPL') + 5 * latest('MSFT');
    expect(sim.current).not.toBeNull();
    expect(sim.current!.weights[0]).toBeCloseTo((10 * latest('AAPL')) / total, 8);
  });

  it('has no current portfolio when quantities are zero', () => {
    const sim = runFrontierSimulation({
      pricesByTicker,
      quantityByTicker: {},
      riskFreeRatePct: 3,
      simulations: 50
    })!;
    expect(sim.current).toBeNull();
  });
});
