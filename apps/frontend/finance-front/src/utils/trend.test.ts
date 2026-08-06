import { movingAverage, linearTrend, mean, halfOverHalfChange } from './trend';

describe('movingAverage', () => {
  it('averages the trailing window', () => {
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });

  it('averages fewer periods at the start rather than dropping them', () => {
    // Same length as the input, so the line starts where the bars do
    expect(movingAverage([10, 20, 30], 12)).toEqual([10, 15, 20]);
  });

  it('is the identity for a window of one', () => {
    expect(movingAverage([3, 1, 4], 1)).toEqual([3, 1, 4]);
  });

  it('copies the values for a nonsensical window', () => {
    expect(movingAverage([3, 1, 4], 0)).toEqual([3, 1, 4]);
  });

  it('handles an empty series', () => {
    expect(movingAverage([], 3)).toEqual([]);
  });
});

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

describe('halfOverHalfChange', () => {
  it('compares the later half with the earlier half', () => {
    // 100,100 → 150,150 is a 50% rise
    expect(halfOverHalfChange([100, 100, 150, 150])).toBeCloseTo(50, 6);
  });

  it('is negative when spending fell', () => {
    expect(halfOverHalfChange([200, 200, 100, 100])).toBeCloseTo(-50, 6);
  });

  it('puts the middle point in the later half for an odd length', () => {
    expect(halfOverHalfChange([100, 200, 200])).toBeCloseTo(100, 6);
  });

  it('is null when there is nothing to compare', () => {
    expect(halfOverHalfChange([5])).toBeNull();
    expect(halfOverHalfChange([])).toBeNull();
  });

  it('is null when the earlier half is zero, rather than infinite', () => {
    expect(halfOverHalfChange([0, 0, 100, 100])).toBeNull();
  });
});
