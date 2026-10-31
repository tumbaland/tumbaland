import {
  PlanInputs,
  bufferMonthsOf,
  incomeIn,
  independenceTarget,
  monthsThrough,
  runRandom,
  runSteady,
  seededRandom,
  whatIfTakeHome
} from './lifePlan';

const plan = (over: Partial<PlanInputs> = {}): PlanInputs => ({
  cash: 0,
  funds: 0,
  pensions: 0,
  spending: 2000,
  extraYearly: 0,
  takeHomeNow: 3000,
  incomeMonths: Infinity,
  gapMonths: 0,
  takeHomeAfter: 3000,
  pensionContribution: 0,
  bufferMonths: 12,
  fillBufferFirst: true,
  years: 5,
  withdrawalRatePct: 4,
  ...over
});

const last = <T,>(values: T[]) => values[values.length - 1];

describe('the independence target', () => {
  it('is a year of spending over the rate it can be lived on', () => {
    expect(independenceTarget(plan({ spending: 2300, withdrawalRatePct: 3.5 }))).toBeCloseTo(788_571.4, 0);
  });

  it('counts travel and one-offs as part of what is lived on', () => {
    expect(independenceTarget(plan({ spending: 2000, extraYearly: 3000, withdrawalRatePct: 4 }))).toBe(675_000);
  });

  it('is out of reach when nothing can be withdrawn', () => {
    expect(independenceTarget(plan({ withdrawalRatePct: 0 }))).toBe(Infinity);
  });
});

describe('where the income goes', () => {
  it('follows the current income, the gap and then the next income', () => {
    const p = plan({ incomeMonths: 3, gapMonths: 2, takeHomeNow: 3000, takeHomeAfter: 1800 });

    expect([0, 2, 3, 4, 5, 9].map((m) => incomeIn(m, p))).toEqual([3000, 3000, 0, 0, 1800, 1800]);
  });

  it('fills the buffer before anything reaches the funds', () => {
    // 1000 a month saved; a 12 month buffer on 2000 of spending is 24000
    const run = runSteady(plan({ years: 3 }), 0);

    expect(run.cash[12]).toBe(12_000);
    expect(run.funds[12]).toBe(0);
    expect(run.cash[24]).toBe(24_000);
    expect(run.funds[24]).toBe(0);
    // after that the saving goes to funds and the buffer stays put
    expect(run.cash[36]).toBe(24_000);
    expect(run.funds[36]).toBe(12_000);
  });

  it('can send everything to funds when the buffer is not to be filled first', () => {
    const run = runSteady(plan({ years: 1, fillBufferFirst: false }), 0);

    expect(run.cash[12]).toBe(0);
    expect(run.funds[12]).toBe(12_000);
  });

  it('adds travel and one-offs to what is spent', () => {
    const run = runSteady(plan({ years: 1, extraYearly: 1200, fillBufferFirst: false }), 0);

    // 3000 in, 2000 + 100 out each month
    expect(run.funds[12]).toBeCloseTo(10_800, 6);
  });

  it('puts the pension contribution into pensions, out of take-home, while there is income', () => {
    const run = runSteady(plan({ years: 1, pensionContribution: 200, fillBufferFirst: false }), 0);

    expect(run.pensions[12]).toBe(2400);
    expect(run.funds[12]).toBe(9600);
  });

  it('stops the pension contribution when there is no income', () => {
    const run = runSteady(
      plan({ years: 1, incomeMonths: 6, gapMonths: 6, pensionContribution: 200, cash: 100_000, fillBufferFirst: false }),
      0
    );

    expect(run.pensions[12]).toBe(1200);
  });
});

describe('the gap between two incomes', () => {
  const gap = (over: Partial<PlanInputs> = {}) =>
    plan({ incomeMonths: 2, gapMonths: 6, takeHomeAfter: 3000, bufferMonths: 0, years: 2, ...over });

  it('is paid from cash first', () => {
    const run = runSteady(gap({ cash: 20_000 }), 0);

    // 2 months of saving go to funds (no buffer to fill), then 6 months of -2000 come out of cash
    expect(run.cash[2]).toBe(20_000);
    expect(run.funds[2]).toBe(2000);
    expect(run.cash[8]).toBe(20_000 - 12_000);
    expect(run.funds[8]).toBe(2000);
  });

  it('draws on the funds once the cash is gone', () => {
    const run = runSteady(gap({ cash: 3000, funds: 50_000, fillBufferFirst: false }), 0);

    expect(run.cash[8]).toBe(0);
    expect(run.funds[8]).toBe(50_000 + 2000 + 3000 - 12_000);
    expect(run.shortfallMonth).toBeNull();
  });

  it('says when the money ran out, and does not let it go negative', () => {
    const run = runSteady(gap({ cash: 0, funds: 3000 }), 0);

    expect(run.shortfallMonth).not.toBeNull();
    expect(Math.min(...run.funds)).toBe(0);
  });

  it('marks the month the income stops', () => {
    expect(runSteady(gap(), 0).incomeEndsAt).toBe(2);
    expect(runSteady(plan(), 0).incomeEndsAt).toBeNull();
  });
});

describe('growth', () => {
  it('compounds funds and pensions at the real return, and leaves cash alone', () => {
    const run = runSteady(plan({ cash: 5000, funds: 100_000, pensions: 50_000, takeHomeNow: 2000, takeHomeAfter: 2000, years: 10 }), 4);

    expect(last(run.funds)).toBeCloseTo(100_000 * 1.04 ** 10, 4);
    expect(last(run.pensions)).toBeCloseTo(50_000 * 1.04 ** 10, 4);
    expect(last(run.cash)).toBe(5000);
  });

  it('counts cash and funds together as what can be reached', () => {
    const run = runSteady(plan({ cash: 5000, funds: 10_000, takeHomeNow: 2000, years: 1 }), 0);

    expect(run.accessible[0]).toBe(15_000);
  });
});

describe('independence', () => {
  it('is already reached when the money covers the target today', () => {
    const run = runSteady(plan({ funds: 600_000, spending: 2000, withdrawalRatePct: 4 }), 4);

    expect(run.independenceMonth).toBe(0);
  });

  it('is reached in the month the accessible money crosses the target', () => {
    // target 600000; 1000 saved a month and no growth
    const run = runSteady(plan({ funds: 594_000, years: 2, fillBufferFirst: false }), 0);

    expect(run.independenceMonth).toBe(6);
  });

  it('is not reached when the horizon is too short', () => {
    expect(runSteady(plan({ funds: 1000, years: 2 }), 4).independenceMonth).toBeNull();
  });
});

describe('random paths', () => {
  const funded = plan({ cash: 20_000, funds: 100_000, years: 10, takeHomeNow: 2600, takeHomeAfter: 2600 });

  it('gives the same answer for the same seed, so a result does not wander', () => {
    expect(runRandom(funded, 4, 15, 200, 7)).toEqual(runRandom(funded, 4, 15, 200, 7));
  });

  it('orders the percentiles', () => {
    const { p10, p50, p90 } = runRandom(funded, 4, 15, 300);

    expect(last(p10)).toBeLessThan(last(p50));
    expect(last(p50)).toBeLessThan(last(p90));
  });

  it('collapses to the steady path when there is no volatility', () => {
    const steady = last(runSteady(funded, 4).accessible);
    const { p10, p90 } = runRandom(funded, 4, 0, 50);

    expect(last(p10)).toBeCloseTo(steady, 4);
    expect(last(p90)).toBeCloseTo(steady, 4);
  });

  it('keeps the average return at the one asked for', () => {
    const steady = last(runSteady(funded, 4).accessible);
    const { p10, p90 } = runRandom(funded, 4, 15, 2000);

    expect(steady).toBeGreaterThan(last(p10));
    expect(steady).toBeLessThan(last(p90));
  });

  it('says how many paths reached the target and how many ran out', () => {
    const plenty = runRandom(plan({ funds: 900_000, years: 3 }), 4, 15, 100);
    const none = runRandom(plan({ funds: 5000, cash: 0, takeHomeNow: 500, takeHomeAfter: 500, years: 3 }), 4, 15, 100);

    expect(plenty.reachedTarget).toBe(1);
    expect(none.ranOut).toBe(1);
  });

  it('starts every year series at today and runs for the horizon', () => {
    const { years, p50 } = runRandom(funded, 4, 15, 50);

    expect(years).toHaveLength(11);
    expect(p50[0]).toBe(120_000);
  });
});

describe('seededRandom', () => {
  it('is repeatable and stays inside zero and one', () => {
    const a = seededRandom(3);
    const b = seededRandom(3);
    const values = Array.from({ length: 100 }, () => a());

    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });
});

describe('what if the next income were different', () => {
  const base = plan({ funds: 100_000, spending: 2300, years: 10, incomeMonths: 0, takeHomeAfter: 3000, takeHomeNow: 3000 });

  it('varies the current income when it never ends, since there is no after', () => {
    const rows = whatIfTakeHome({ ...base, incomeMonths: Infinity, takeHomeNow: 2300 }, 4, [2300, 3300]);

    expect(rows[1].accessibleAtEnd).toBeGreaterThan(rows[0].accessibleAtEnd);
  });

  it('shows more at the end for a higher take-home, and an earlier independence', () => {
    const rows = whatIfTakeHome(base, 4, [2500, 3000, 4000]);

    expect(rows[0].accessibleAtEnd).toBeLessThan(rows[1].accessibleAtEnd);
    expect(rows[1].accessibleAtEnd).toBeLessThan(rows[2].accessibleAtEnd);
    expect(rows[2].monthlySaving).toBe(1700);
  });

  it('subtracts the pension contribution from what is saved', () => {
    const [row] = whatIfTakeHome({ ...base, pensionContribution: 200 }, 4, [3000]);

    expect(row.monthlySaving).toBe(500);
  });

  it('reports independence as null when it is out of reach', () => {
    const [row] = whatIfTakeHome({ ...base, funds: 1000, years: 3 }, 4, [2400]);

    expect(row.independenceYears).toBeNull();
  });
});

describe('small helpers', () => {
  it('counts the months of income through the end date, both ends included', () => {
    // November 2026 through August 2027 is ten months
    expect(monthsThrough(new Date(2026, 10, 15), new Date(2027, 7, 31))).toBe(10);
    expect(monthsThrough(new Date(2026, 10, 1), new Date(2026, 10, 30))).toBe(1);
  });

  it('never counts a date already past as negative', () => {
    expect(monthsThrough(new Date(2026, 10, 1), new Date(2026, 5, 1))).toBe(0);
  });

  it('reads cash as months of spending', () => {
    expect(bufferMonthsOf(9000, 2300)).toBeCloseTo(3.91, 2);
    expect(bufferMonthsOf(9000, 0)).toBe(0);
  });
});
