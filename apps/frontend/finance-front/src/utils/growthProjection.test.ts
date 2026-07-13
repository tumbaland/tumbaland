import {
  LONG_RUN_RETURN_PCT,
  SCENARIO_PRESETS,
  ProjectionParams,
  projectDeterministic,
  runMonteCarloBands,
  shrinkExpectedReturn,
  yearsToGoal
} from './growthProjection';

const base = (overrides: Partial<ProjectionParams> = {}): ProjectionParams => ({
  startingCapital: 1000,
  monthlyContribution: 0,
  years: 1,
  expectedAnnualReturnPct: 12,
  annualVolatilityPct: 0,
  annualInflationPct: 0,
  annualFeePct: 0,
  ...overrides
});

describe('projectDeterministic', () => {
  it('compounds monthly to exactly the annual rate with no contributions', () => {
    const rows = projectDeterministic(base());
    expect(rows).toHaveLength(1);
    expect(rows[0].portfolioTotalValue).toBeCloseTo(1120, 6);
    expect(rows[0].moneyInvested).toBe(1000);
    expect(rows[0].gainFromMarket).toBeCloseTo(120, 6);
  });

  it('returns one row per year', () => {
    const rows = projectDeterministic(base({ years: 30 }));
    expect(rows).toHaveLength(30);
    expect(rows[29].year).toBe(30);
  });

  it('tracks contributions with zero growth', () => {
    const rows = projectDeterministic(base({ expectedAnnualReturnPct: 0, monthlyContribution: 100 }));
    expect(rows[0].moneyInvested).toBe(1000 + 1200);
    expect(rows[0].portfolioTotalValue).toBeCloseTo(2200, 6);
    expect(rows[0].gainFromMarket).toBeCloseTo(0, 6);
  });

  it('applies fees multiplicatively against growth', () => {
    // (1 + 10%) * (1 - 10%) - 1 = -1% net
    const rows = projectDeterministic(base({ expectedAnnualReturnPct: 10, annualFeePct: 10 }));
    expect(rows[0].portfolioTotalValue).toBeCloseTo(990, 6);
  });

  it('discounts the inflation-adjusted value', () => {
    const rows = projectDeterministic(base({ years: 2, annualInflationPct: 2.5 }));
    expect(rows[1].inflationAdjustedValue).toBeCloseTo(rows[1].portfolioTotalValue / Math.pow(1.025, 2), 6);
  });
});

describe('yearsToGoal', () => {
  const rows = projectDeterministic(base({ years: 10 }));

  it('finds the first year the portfolio reaches the goal', () => {
    // 1000 * 1.12^y >= 2000 → y = 7
    expect(yearsToGoal(rows, 2000)).toBe(7);
  });

  it('returns undefined when the goal is out of reach', () => {
    expect(yearsToGoal(rows, 1e9)).toBeUndefined();
  });
});

describe('runMonteCarloBands', () => {
  it('produces one band point per year with p10 <= p50 <= p90', () => {
    const bands = runMonteCarloBands(base({ years: 5, annualVolatilityPct: 15 }), 300);
    expect(bands.years).toEqual([1, 2, 3, 4, 5]);
    for (let i = 0; i < 5; i++) {
      expect(bands.p10[i]).toBeLessThanOrEqual(bands.p50[i]);
      expect(bands.p50[i]).toBeLessThanOrEqual(bands.p90[i]);
    }
  });

  it('collapses to exactly the deterministic path at zero volatility', () => {
    const bands = runMonteCarloBands(base({ years: 3 }), 50);
    for (let i = 0; i < 3; i++) {
      expect(bands.p10[i]).toBeCloseTo(bands.p90[i], 6);
    }
    // drift is calibrated so the mean path compounds at (1 + mu)^t
    expect(bands.p50[2]).toBeCloseTo(1000 * Math.pow(1.12, 3), 4);
  });

  it('keeps the median below the deterministic path under volatility (drag, not drift)', () => {
    const bands = runMonteCarloBands(base({ years: 10, expectedAnnualReturnPct: 30, annualVolatilityPct: 20 }), 2000);
    const deterministic = projectDeterministic(base({ years: 10, expectedAnnualReturnPct: 30 }));
    expect(bands.p50[9]).toBeLessThan(deterministic[9].portfolioTotalValue);
  });

  it('widens the band as volatility rises', () => {
    const narrow = runMonteCarloBands(base({ years: 5, annualVolatilityPct: 5 }), 500);
    const wide = runMonteCarloBands(base({ years: 5, annualVolatilityPct: 30 }), 500);
    const spread = (b: typeof narrow) => b.p90[4] - b.p10[4];
    expect(spread(wide)).toBeGreaterThan(spread(narrow));
  });
});

describe('shrinkExpectedReturn', () => {
  it('pulls a short-sample estimate most of the way to the long-run anchor', () => {
    // 122 days of a 34% bull run must not drive a 30-year projection
    const shrunk = shrinkExpectedReturn(34.4, 122);
    expect(shrunk).toBeLessThan(12.5);
    expect(shrunk).toBeGreaterThan(LONG_RUN_RETURN_PCT);
  });

  it('weights history and anchor equally at 3 years of data', () => {
    expect(shrinkExpectedReturn(20, 756)).toBeCloseTo((20 + LONG_RUN_RETURN_PCT) / 2, 8);
  });

  it('returns the anchor with no data', () => {
    expect(shrinkExpectedReturn(50, 0)).toBe(LONG_RUN_RETURN_PCT);
  });
});

describe('SCENARIO_PRESETS', () => {
  it('orders risk and reward consistently', () => {
    expect(SCENARIO_PRESETS.conservative.growth).toBeLessThan(SCENARIO_PRESETS.base.growth);
    expect(SCENARIO_PRESETS.base.growth).toBeLessThan(SCENARIO_PRESETS.aggressive.growth);
    expect(SCENARIO_PRESETS.conservative.volatility).toBeLessThan(SCENARIO_PRESETS.aggressive.volatility);
  });
});
