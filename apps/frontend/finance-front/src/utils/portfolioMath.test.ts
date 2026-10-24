import { mean, covariance } from './portfolioMath';

describe('mean', () => {
  it('averages the values', () => {
    expect(mean([2, 4, 6])).toBe(4);
  });
  it('returns 0 for an empty array', () => {
    expect(mean([])).toBe(0);
  });
});

describe('covariance', () => {
  it('equals the sample variance when both series are identical', () => {
    // sample variance of [1,2,3] = ((1-2)^2+(2-2)^2+(3-2)^2)/2 = 1
    expect(covariance([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });
  it('is negative for anti-correlated series', () => {
    expect(covariance([1, 2, 3], [3, 2, 1])).toBeLessThan(0);
  });
  it('returns 0 when there is not enough data', () => {
    expect(covariance([5], [5])).toBe(0);
    expect(covariance([], [])).toBe(0);
  });
});
