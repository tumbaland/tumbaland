import {
  MAX_GAP_DAYS,
  MAX_RETURN_GAP_DAYS,
  PERIODS_PER_YEAR,
  TRADING_WEEKS,
  PricePoint,
  TRADING_DAYS,
  alignSeries,
  dailyReturns,
  describePortfolio,
  portfolioStats,
  randomWeights,
  returnIndices,
  runFrontierSimulation
} from './frontierSim';

/** Consecutive trading days, weekends skipped, starting on a Monday. */
function tradingDays(count: number, start = '2026-01-05'): string[] {
  const dates: string[] = [];
  const day = new Date(`${start}T00:00:00.000Z`);
  while (dates.length < count) {
    if (![0, 6].includes(day.getUTCDay())) dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return dates;
}

const dated = (prices: number[], dates = tradingDays(prices.length)): PricePoint[] =>
  prices.map((price, i) => ({ date: dates[i], price }));

describe('dailyReturns', () => {
  it('computes simple returns between consecutive prices', () => {
    expect(dailyReturns([100, 110, 99])).toEqual([0.1, -0.1]);
  });

  it('returns an empty array for fewer than 2 prices', () => {
    expect(dailyReturns([100])).toEqual([]);
  });

  it('takes returns only at the given indices, so a gap can be skipped', () => {
    expect(dailyReturns([100, 110, 99], [1])).toEqual([0.1]);
  });
});

describe('alignSeries', () => {
  it('keeps only the days on which every ticker traded', () => {
    const aligned = alignSeries({
      AAPL: dated([1, 2, 3], ['2026-01-05', '2026-01-06', '2026-01-07']),
      MSFT: dated([10, 20], ['2026-01-06', '2026-01-07'])
    });

    expect(aligned.dates).toEqual(['2026-01-06', '2026-01-07']);
    expect(aligned.prices).toEqual([[2, 3], [10, 20]]);
  });

  it('reports the span of the overlap, not of the longest series', () => {
    // A decade of one instrument against a month of another is a month of
    // usable history — which is exactly the case that made the planner refuse.
    const aligned = alignSeries({
      OLD: dated([1, 2, 3], ['2015-01-05', '2026-02-02', '2026-02-03']),
      NEW: dated([10, 20], ['2026-02-02', '2026-02-03'])
    });

    expect(aligned.spanDays).toBe(1);
  });

  it('sorts the shared days ascending regardless of input order', () => {
    const aligned = alignSeries({
      A: dated([3, 1, 2], ['2026-01-07', '2026-01-05', '2026-01-06']),
      B: dated([30, 10, 20], ['2026-01-07', '2026-01-05', '2026-01-06'])
    });

    expect(aligned.dates).toEqual(['2026-01-05', '2026-01-06', '2026-01-07']);
    expect(aligned.prices[0]).toEqual([1, 2, 3]);
  });

  it('is empty for no tickers', () => {
    expect(alignSeries({})).toEqual({ tickers: [], dates: [], prices: [], spanDays: 0 });
  });
});

describe('returnIndices', () => {
  it('admits a weekend but not a data gap', () => {
    const indices = returnIndices(['2026-01-09', '2026-01-12', '2026-06-01']);
    // Fri→Mon is a weekend and counts; Jan→Jun is a hole and does not.
    expect(indices).toEqual([1]);
  });

  it('takes every step when the series is contiguous', () => {
    expect(returnIndices(tradingDays(4))).toEqual([1, 2, 3]);
  });

  it('respects an explicit gap tolerance', () => {
    const dates = ['2026-01-05', '2026-01-20'];
    expect(returnIndices(dates)).toEqual([]);
    expect(returnIndices(dates, MAX_RETURN_GAP_DAYS + 10)).toEqual([1]);
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

function series(base: number, seed: number, count = 25): PricePoint[] {
  const out: number[] = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    price *= 1 + (Math.sin(i + seed) * 0.01 + 0.001);
    out.push(price);
  }
  return dated(out);
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
    const latest = (t: 'AAPL' | 'MSFT') => pricesByTicker[t][pricesByTicker[t].length - 1].price;
    const total = 10 * latest('AAPL') + 5 * latest('MSFT');
    expect(sim.current).not.toBeNull();
    expect(sim.current!.weights[0]).toBeCloseTo((10 * latest('AAPL')) / total, 8);
  });

  it('scores only the overlapping days when one series starts later', () => {
    const long = series(150, 1, 25);
    // Same instrument, observed from the eleventh day on.
    const short = { MSFT: series(300, 2, 25).slice(10) };
    const sim = runFrontierSimulation({
      pricesByTicker: { AAPL: long, ...short },
      quantityByTicker,
      riskFreeRatePct: 3,
      simulations: 50
    })!;

    // 15 shared days → 14 returns, rather than the 24 a position-paired
    // covariance would have silently used.
    expect(sim.dataPoints).toBe(14);
  });

  it('refuses rather than estimating from a single return', () => {
    expect(
      runFrontierSimulation({
        pricesByTicker: { AAPL: series(150, 1, 2), MSFT: series(300, 2, 2) },
        quantityByTicker,
        riskFreeRatePct: 3
      })
    ).toBeNull();
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

describe('describePortfolio', () => {
  // One asset, so every figure can be checked by hand.
  const means = [0.001];
  const cov = [[0.0001]]; // daily σ = 1%, annualized √(0.0001×252) = 15.87%

  it('annualizes the arithmetic mean the same way the frontier does', () => {
    const d = describePortfolio([1], means, cov, 0, 100);
    expect(d.arithmeticPct).toBeCloseTo(0.001 * TRADING_DAYS * 100, 8);
    expect(d.volPct).toBeCloseTo(Math.sqrt(0.0001 * TRADING_DAYS) * 100, 8);
  });

  it('reports the variance drag and the compounded figure below it', () => {
    const d = describePortfolio([1], means, cov, 0, 100);
    // σ²/2 with σ² = 0.0001 × 252
    expect(d.varianceDragPct).toBeCloseTo(((0.0001 * TRADING_DAYS) / 2) * 100, 8);
    expect(d.geometricPct).toBeCloseTo(d.arithmeticPct - d.varianceDragPct, 8);
    expect(d.geometricPct).toBeLessThan(d.arithmeticPct);
  });

  it('widens the interval as the sample shrinks', () => {
    const long = describePortfolio([1], means, cov, 0, 1008);
    const short = describePortfolio([1], means, cov, 0, 63);
    // SE scales with 1/√n: a quarter of the sample doubles it.
    expect(short.standardErrorPct).toBeCloseTo(long.standardErrorPct * 4, 6);
    expect(short.ci95[1] - short.ci95[0]).toBeGreaterThan(long.ci95[1] - long.ci95[0]);
  });

  it('centres the interval on the estimate at ±1.96 SE', () => {
    const d = describePortfolio([1], means, cov, 0, 106);
    expect(d.ci95[0]).toBeCloseTo(d.arithmeticPct - 1.96 * d.standardErrorPct, 8);
    expect(d.ci95[1]).toBeCloseTo(d.arithmeticPct + 1.96 * d.standardErrorPct, 8);
  });

  it('admits a loss in the interval when a strong short sample is annualized', () => {
    // The shipped case: ~34%/yr estimated off ~106 daily returns at ~14% vol.
    const d = describePortfolio([1], [0.00135], [[0.0000766]], 3, 106);
    expect(d.arithmeticPct).toBeCloseTo(34.0, 0);
    expect(d.standardErrorPct).toBeGreaterThan(20);
    expect(d.ci95[0]).toBeLessThan(0);
  });

  it('subtracts the risk-free rate in the Sharpe ratio', () => {
    const d = describePortfolio([1], means, cov, 25.2, 100);
    expect(d.sharpe).toBeCloseTo(0, 6);
  });
});

describe('runFrontierSimulation breakdown', () => {
  const pricesByTicker = { AAPL: series(150, 1), MSFT: series(300, 2) };
  const quantityByTicker = { AAPL: 10, MSFT: 5 };

  it('reports the window the estimate was fitted to', () => {
    const sim = runFrontierSimulation({ pricesByTicker, quantityByTicker, riskFreeRatePct: 3, simulations: 50 })!;
    const { window } = sim.breakdown;

    expect(window.observations).toBe(sim.dataPoints);
    expect(window.from).toBe(pricesByTicker.AAPL[0].date);
    expect(window.to).toBe(pricesByTicker.AAPL[pricesByTicker.AAPL.length - 1].date);
  });

  it('decomposes the portfolio figure into per-holding contributions that sum to it', () => {
    const sim = runFrontierSimulation({ pricesByTicker, quantityByTicker, riskFreeRatePct: 3, simulations: 50 })!;
    const { assets, current } = sim.breakdown;

    const summed = assets.reduce((s, a) => s + (a.contributionPct ?? 0), 0);
    expect(summed).toBeCloseTo(current!.arithmeticPct, 8);
    // And that figure is the one the chart plots for the current portfolio.
    expect(current!.arithmeticPct).toBeCloseTo(sim.current!.ret, 8);
    expect(assets.reduce((s, a) => s + (a.weight ?? 0), 0)).toBeCloseTo(1, 8);
  });

  it('reports each holding\'s own window return alongside its annualized mean', () => {
    const sim = runFrontierSimulation({ pricesByTicker, quantityByTicker, riskFreeRatePct: 3, simulations: 50 })!;
    const aapl = sim.breakdown.assets.find(a => a.ticker === 'AAPL')!;
    const prices = pricesByTicker.AAPL;
    const expected = ((prices[prices.length - 1].price - prices[0].price) / prices[0].price) * 100;

    expect(aapl.windowReturnPct).toBeCloseTo(expected, 8);
  });

  it('reports correlations, with 1 on the diagonal', () => {
    const sim = runFrontierSimulation({ pricesByTicker, quantityByTicker, riskFreeRatePct: 3, simulations: 50 })!;
    const { correlations } = sim.breakdown;

    expect(correlations[0][0]).toBeCloseTo(1, 8);
    expect(correlations[1][1]).toBeCloseTo(1, 8);
    expect(correlations[0][1]).toBeCloseTo(correlations[1][0], 8);
    expect(Math.abs(correlations[0][1])).toBeLessThanOrEqual(1);
  });

  it('has no portfolio arithmetic to show without quantities', () => {
    const sim = runFrontierSimulation({ pricesByTicker, quantityByTicker: {}, riskFreeRatePct: 3, simulations: 50 })!;

    expect(sim.breakdown.current).toBeNull();
    expect(sim.breakdown.assets.every(a => a.weight === null && a.contributionPct === null)).toBe(true);
  });
});


/** Consecutive Fridays, as a weekly series arrives. */
function weeks(count: number, start = '2024-03-22'): string[] {
  const dates: string[] = [];
  const day = new Date(`${start}T00:00:00.000Z`);
  for (let i = 0; i < count; i++) {
    dates.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 7);
  }
  return dates;
}

function weeklySeries(base: number, seed: number, count = 130): PricePoint[] {
  const out: number[] = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    price *= 1 + (Math.sin(i + seed) * 0.02 + 0.002);
    out.push(price);
  }
  return dated(out, weeks(count));
}

describe('return basis', () => {
  const quantityByTicker = { AAPL: 10, MSFT: 5 };
  const weekly = { AAPL: weeklySeries(150, 1), MSFT: weeklySeries(300, 2) };

  it('annualizes weekly returns by 52, not 252', () => {
    const sim = runFrontierSimulation({
      pricesByTicker: weekly,
      quantityByTicker,
      riskFreeRatePct: 0,
      simulations: 50,
      basis: 'weekly'
    })!;

    expect(sim.breakdown.basis).toBe('weekly');
    expect(sim.breakdown.periodsPerYear).toBe(TRADING_WEEKS);

    // The same series read as daily would report a figure about 252/52 larger —
    // which is precisely the mistake the basis exists to prevent.
    const asDaily = runFrontierSimulation({
      pricesByTicker: weekly,
      quantityByTicker,
      riskFreeRatePct: 0,
      simulations: 50,
      basis: 'daily'
    })!;

    expect(asDaily.breakdown.current!.arithmeticPct / sim.breakdown.current!.arithmeticPct).toBeCloseTo(
      PERIODS_PER_YEAR.daily / PERIODS_PER_YEAR.weekly,
      6
    );
  });

  it('converts the sample to trading-day equivalents', () => {
    const sim = runFrontierSimulation({
      pricesByTicker: weekly,
      quantityByTicker,
      riskFreeRatePct: 0,
      simulations: 20,
      basis: 'weekly'
    })!;

    // 129 weekly returns are ~2.5 years of market, not ~6 months. Anything that
    // weighs "how much history is this" must see the former.
    expect(sim.breakdown.equivalentTradingDays).toBe(
      Math.round((sim.breakdown.window.observations * PERIODS_PER_YEAR.daily) / TRADING_WEEKS)
    );
    expect(sim.breakdown.equivalentTradingDays).toBeGreaterThan(sim.breakdown.window.observations * 4);
  });

  it('tolerates a holiday fortnight on a weekly series that the daily rule rejects', () => {
    // Weekly closes normally sit 7 days apart — inside the daily tolerance too.
    // The bases diverge at 14 days, which is a missing week for a weekly series
    // and a fortnight-long hole for a daily one.
    const dates = ['2026-01-02', '2026-01-09', '2026-01-23'];

    expect(returnIndices(dates, MAX_GAP_DAYS.daily)).toEqual([1]);
    expect(returnIndices(dates, MAX_GAP_DAYS.weekly)).toEqual([1, 2]);
  });

  it('still drops a missing fortnight from a weekly series', () => {
    const indices = returnIndices(['2026-01-02', '2026-01-09', '2026-02-06'], MAX_GAP_DAYS.weekly);

    expect(indices).toEqual([1]);
  });

  it('defaults to daily when no basis is named', () => {
    const sim = runFrontierSimulation({
      pricesByTicker: { AAPL: series(150, 1), MSFT: series(300, 2) },
      quantityByTicker,
      riskFreeRatePct: 0,
      simulations: 20
    })!;

    expect(sim.breakdown.basis).toBe('daily');
    expect(sim.breakdown.periodsPerYear).toBe(252);
    expect(sim.breakdown.equivalentTradingDays).toBe(sim.breakdown.window.observations);
    expect(MAX_RETURN_GAP_DAYS).toBe(MAX_GAP_DAYS.daily);
  });

  it('reports a narrower interval for the same portfolio on a longer sample', () => {
    const long = runFrontierSimulation({
      pricesByTicker: weekly,
      quantityByTicker,
      riskFreeRatePct: 0,
      simulations: 20,
      basis: 'weekly'
    })!;
    const short = runFrontierSimulation({
      pricesByTicker: { AAPL: weeklySeries(150, 1, 30), MSFT: weeklySeries(300, 2, 30) },
      quantityByTicker,
      riskFreeRatePct: 0,
      simulations: 20,
      basis: 'weekly'
    })!;

    expect(long.breakdown.current!.standardErrorPct).toBeLessThan(short.breakdown.current!.standardErrorPct);
  });
});
