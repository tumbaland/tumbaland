import {
  ANCHOR_DAYS,
  DEFAULT_ANCHOR_PCT,
  effectiveHoldings,
  expectedReturnsPct,
  holdingsUsed,
  frontierPointAtVol,
  frontierReturnAtVol,
  frontierVolAtReturn,
  historyWeight,
  maxDrawdownPct,
  maxReturnWeights,
  newMoneyPlan,
  optimize,
  portfolioReturns,
  projectCappedSimplex,
  riskContributions,
  shrinkExpectedReturn,
  solveMeanVariance,
  statsOf,
  worstWindowPct
} from './optimizer';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// Two uncorrelated assets, one riskier and better paid
const MU2 = [0.08, 0.04];
const COV2 = [
  [0.04, 0],
  [0, 0.01]
];

// Four assets with some correlation, so the answers are not corners
const MU4 = [0.07, 0.05, 0.06, 0.03];
const COV4 = [
  [0.04, 0.012, 0.01, 0.002],
  [0.012, 0.02, 0.008, 0.002],
  [0.01, 0.008, 0.03, 0.002],
  [0.002, 0.002, 0.002, 0.004]
];

describe('projectCappedSimplex', () => {
  it('leaves weights that are already feasible alone', () => {
    const w = projectCappedSimplex([0.2, 0.3, 0.5], 1);
    [0.2, 0.3, 0.5].forEach((x, i) => expect(w[i]).toBeCloseTo(x, 8));
  });

  it('sums to one and stays within zero and the cap', () => {
    const w = projectCappedSimplex([3, -2, 0.4, 1.1], 0.4);

    expect(sum(w)).toBeCloseTo(1, 9);
    w.forEach((x) => {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(0.4 + 1e-9);
    });
  });

  it('splits evenly when the cap leaves no other way to reach one', () => {
    projectCappedSimplex([9, 0, 0], 1 / 3).forEach((x) => expect(x).toBeCloseTo(1 / 3, 6));
  });
});

describe('solveMeanVariance', () => {
  it('finds the analytic answer for two uncorrelated assets', () => {
    // Lagrange: w1 = (0.08 - v)/(4 * 0.04), w2 = (0.04 - v)/(4 * 0.01), v = 0.016
    const [w1, w2] = solveMeanVariance(MU2, COV2, 4, 1);

    expect(w1).toBeCloseTo(0.4, 5);
    expect(w2).toBeCloseTo(0.6, 5);
  });

  it('puts everything in the better paid asset when risk does not matter', () => {
    const [w1] = solveMeanVariance(MU2, COV2, 1e-4, 1);
    expect(w1).toBeCloseTo(1, 5);
  });

  it('weights by inverse variance when only risk matters', () => {
    const [w1, w2] = solveMeanVariance(MU2, COV2, 1e6, 1);

    expect(w1).toBeCloseTo(0.2, 4);
    expect(w2).toBeCloseTo(0.8, 4);
  });

  it('never exceeds the cap', () => {
    solveMeanVariance(MU4, COV4, 0.5, 0.4).forEach((x) => expect(x).toBeLessThanOrEqual(0.4 + 1e-9));
  });
});

describe('maxReturnWeights', () => {
  it('fills the best paid holdings first, up to the cap', () => {
    expect(maxReturnWeights([0.03, 0.07, 0.05], 0.5)).toEqual([0, 0.5, 0.5]);
  });

  it('puts all of it in the best holding without a cap', () => {
    expect(maxReturnWeights(MU4, 1)).toEqual([1, 0, 0, 0]);
  });
});

describe('optimize', () => {
  const rf = 0.02;
  const result = optimize(MU4, COV4, rf, 1);

  it('returns a frontier that earns more as it takes more risk', () => {
    for (let i = 1; i < result.frontier.length; i++) {
      expect(result.frontier[i].vol).toBeGreaterThan(result.frontier[i - 1].vol);
      expect(result.frontier[i].ret).toBeGreaterThan(result.frontier[i - 1].ret);
    }
  });

  it('runs from the minimum-risk portfolio to the highest return', () => {
    expect(result.frontier[0].vol).toBeCloseTo(result.minVol.vol, 6);
    expect(result.frontier[result.frontier.length - 1].ret).toBeCloseTo(0.07, 6);
  });

  it('beats every random portfolio on Sharpe, which sampling only approaches', () => {
    let randomBest = -Infinity;
    for (let i = 0; i < 20_000; i++) {
      const raw = MU4.map(() => -Math.log(Math.random() + 1e-12));
      const total = sum(raw);
      randomBest = Math.max(randomBest, statsOf(raw.map((x) => x / total), MU4, COV4, rf).sharpe);
    }

    expect(result.maxSharpe.sharpe).toBeGreaterThanOrEqual(randomBest - 1e-9);
  });

  it('puts the best Sharpe at least as high as any point on its own frontier', () => {
    result.frontier.forEach((p) => expect(result.maxSharpe.sharpe).toBeGreaterThanOrEqual(p.sharpe - 1e-9));
  });

  it('keeps every portfolio long-only and fully invested', () => {
    [...result.frontier, result.maxSharpe, result.minVol].forEach((p) => {
      expect(sum(p.weights)).toBeCloseTo(1, 6);
      p.weights.forEach((x) => expect(x).toBeGreaterThanOrEqual(-1e-9));
    });
  });

  it('respects a cap on any one holding, and gives up some Sharpe for it', () => {
    const capped = optimize(MU4, COV4, rf, 0.4);

    [...capped.frontier, capped.maxSharpe].forEach((p) => p.weights.forEach((x) => expect(x).toBeLessThanOrEqual(0.4 + 1e-6)));
    expect(capped.maxSharpe.sharpe).toBeLessThanOrEqual(result.maxSharpe.sharpe + 1e-9);
  });

  it('cannot cap below an equal split', () => {
    const forced = optimize(MU4, COV4, rf, 0.1);

    expect(forced.cap).toBeCloseTo(0.25, 9);
    forced.minVol.weights.forEach((x) => expect(x).toBeCloseTo(0.25, 4));
  });
});

describe('reading a frontier', () => {
  const { frontier } = optimize(MU4, COV4, 0.02, 1);
  const middle = frontier[Math.floor(frontier.length / 2)];

  it('gives the return a frontier earns at a risk level', () => {
    expect(frontierReturnAtVol(frontier, middle.vol)).toBeCloseTo(middle.ret, 6);
  });

  it('gives the least risk that earns a return', () => {
    expect(frontierVolAtReturn(frontier, middle.ret)).toBeCloseTo(middle.vol, 6);
  });

  it('has no answer for less risk than the minimum, or more return than the maximum', () => {
    expect(frontierReturnAtVol(frontier, frontier[0].vol / 2)).toBeNull();
    expect(frontierVolAtReturn(frontier, 0.5)).toBeNull();
  });

  it('picks the best portfolio at or under a risk level', () => {
    const point = frontierPointAtVol(frontier, middle.vol + 1e-4)!;

    expect(point.vol).toBeLessThanOrEqual(middle.vol + 1e-4);
    expect(point.ret).toBeGreaterThanOrEqual(middle.ret - 1e-9);
  });

  it('falls back to the least risky when the level is below every point', () => {
    expect(frontierPointAtVol(frontier, 0)).toBe(frontier[0]);
  });
});

describe('what a portfolio is made of', () => {
  it('shares the risk out so the shares sum to one', () => {
    expect(sum(riskContributions([0.4, 0.3, 0.2, 0.1], COV4))).toBeCloseTo(1, 9);
  });

  it('gives a risky holding more of the risk than of the money', () => {
    const [risky, safe] = riskContributions([0.5, 0.5], COV2);

    expect(risky).toBeGreaterThan(0.5);
    expect(risky).toBeCloseTo(0.04 / 0.05, 9);
    expect(safe).toBeCloseTo(0.01 / 0.05, 9);
  });

  it('counts the holdings a portfolio effectively has', () => {
    expect(effectiveHoldings([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(4, 9);
    expect(effectiveHoldings([1, 0, 0, 0])).toBe(1);
  });
});

describe('how many holdings are used', () => {
  it('counts the ones with a meaningful share', () => {
    expect(holdingsUsed([0.737, 0.263, 0, 0, 0, 0])).toBe(2);
    expect(holdingsUsed([0.25, 0.25, 0.25, 0.25])).toBe(4);
  });

  it('ignores a rounding crumb', () => {
    expect(holdingsUsed([0.995, 0.005, 0])).toBe(1);
  });
});

describe('what it would have been through', () => {
  it('measures the fall from the peak', () => {
    // 1.1, 0.88, 0.968: the drop from 1.1 to 0.88 is 20%
    expect(maxDrawdownPct([0.1, -0.2, 0.1])).toBeCloseTo(-20, 9);
  });

  it('is zero when it only ever rose', () => {
    expect(maxDrawdownPct([0.01, 0.02, 0.03])).toBe(0);
  });

  it('finds the worst run of periods, compounding them', () => {
    // any two in a row: 1.1 * 0.8 and 0.8 * 1.1 are both 0.88
    expect(worstWindowPct([0.1, -0.2, 0.1], 2)).toBeCloseTo(-12, 9);
  });

  it('has no worst window when the history is shorter than it', () => {
    expect(worstWindowPct([0.1, -0.2], 5)).toBeNull();
  });

  it('combines holdings by weight, period by period', () => {
    expect(portfolioReturns([0.5, 0.5], [[0.1, 0.0], [0.0, -0.2]])).toEqual([0.05, -0.1]);
  });
});

describe('putting new money to work', () => {
  it('sums to the money and never sells', () => {
    const plan = newMoneyPlan([5000, 3000, 2000], [0.3, 0.4, 0.3], 2000);

    expect(sum(plan)).toBeCloseTo(2000, 6);
    plan.forEach((x) => expect(x).toBeGreaterThanOrEqual(0));
  });

  it('puts it in what is furthest behind', () => {
    // 10 000 held; target 30/40/30 of 12 000 is 3600/4800/3600, so only the last two are short
    const plan = newMoneyPlan([6000, 2000, 2000], [0.3, 0.4, 0.3], 2000);

    expect(plan[0]).toBeCloseTo(0, 6);
    expect(plan[1]).toBeGreaterThan(plan[2]);
  });

  it('shares what there is in proportion to the gaps when it cannot close them all', () => {
    const plan = newMoneyPlan([8000, 1000, 1000], [0.2, 0.4, 0.4], 500);

    expect(plan[0]).toBe(0);
    expect(plan[1]).toBeCloseTo(plan[2], 6);
    expect(sum(plan)).toBeCloseTo(500, 6);
  });

  it('spreads it by the target when already on target', () => {
    const plan = newMoneyPlan([3000, 4000, 3000], [0.3, 0.4, 0.3], 1000);

    expect(plan[0]).toBeCloseTo(300, 6);
    expect(plan[1]).toBeCloseTo(400, 6);
  });

  it('is nothing for no money', () => {
    expect(newMoneyPlan([1, 2], [0.5, 0.5], 0)).toEqual([0, 0]);
  });
});

describe('expected returns', () => {
  const history = [30, 5, 10];

  it('takes history as it is when asked to', () => {
    expect(expectedReturnsPct(history, 'history', 500)).toEqual(history);
  });

  it('gives every holding the same return when told history says nothing', () => {
    expect(expectedReturnsPct(history, 'equal', 500, 5)).toEqual([5, 5, 5]);
  });

  it('pulls a hot streak back toward the long-run figure', () => {
    const [hot] = expectedReturnsPct(history, 'shrunk', 250);

    expect(hot).toBeLessThan(30);
    expect(hot).toBeGreaterThan(DEFAULT_ANCHOR_PCT);
  });

  it('trusts history more as the sample grows', () => {
    expect(shrinkExpectedReturn(30, 100)).toBeLessThan(shrinkExpectedReturn(30, 5000));
    expect(historyWeight(ANCHOR_DAYS)).toBeCloseTo(0.5, 9);
  });

  it('falls back to the anchor with no history at all', () => {
    expect(shrinkExpectedReturn(50, 0)).toBe(DEFAULT_ANCHOR_PCT);
  });
});
