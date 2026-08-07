import { linearTrend, mean, profile } from './trend';

describe('linearTrend', () => {
  it('is the per-period slope of a straight line', () => {
    expect(linearTrend([100, 200, 300, 400])).toBeCloseTo(100, 6);
  });

  it('is negative when the series falls', () => {
    expect(linearTrend([400, 300, 200])).toBeCloseTo(-100, 6);
  });

  it('is zero for a flat series', () => {
    expect(linearTrend([50, 50, 50])).toBe(0);
  });

  it('is not thrown off by a single outlier the way endpoints would be', () => {
    // First-to-last would read this as strongly rising; the fit does not
    const slope = linearTrend([100, 100, 100, 100, 400]);
    expect(slope).toBeLessThan(100);
    expect(slope).toBeGreaterThan(0);
  });

  it('is zero with fewer than two points', () => {
    expect(linearTrend([5])).toBe(0);
    expect(linearTrend([])).toBe(0);
  });
});

describe('mean', () => {
  it('averages the values', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });

  it('is zero for an empty series', () => {
    expect(mean([])).toBe(0);
  });
});

describe('profile', () => {
  it('takes the middle month, not the average', () => {
    // One holiday must not become everyone's idea of a normal month
    const p = profile([100, 100, 100, 100, 5000], 5)!;

    expect(p.median).toBe(100);
  });

  it('averages the two middle values on an even window', () => {
    expect(profile([10, 20, 30, 40], 4)!.median).toBe(25);
  });

  it('reports the range, so the median is not read as a budget', () => {
    const p = profile([80, 100, 250], 3)!;

    expect(p.low).toBe(80);
    expect(p.high).toBe(250);
  });

  it('keeps the most recent period, which is what gets compared', () => {
    const p = profile([10, 20, 30], 3)!;

    expect(p.latest).toBe(30);
    expect(p.latestIndex).toBe(2);
  });

  it('only looks at the last n periods', () => {
    const p = profile([1, 1, 1, 500, 600, 700], 3)!;

    expect(p.values).toEqual([500, 600, 700]);
    expect(p.median).toBe(600);
  });

  it('takes everything when there is less history than asked for', () => {
    expect(profile([42], 12)!.values).toEqual([42]);
  });

  it('has nothing to say about an empty series', () => {
    expect(profile([], 12)).toBeNull();
  });
});
