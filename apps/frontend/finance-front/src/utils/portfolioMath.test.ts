import {
  mean,
  covariance,
  dot,
  matVecMul,
  invertMatrix,
  weightsMinVariance,
  weightsTangency,
  weightsTargetReturn,
  portfolioVariance,
  portfolioReturn,
  projectToSimplex,
  Matrix
} from './portfolioMath';

const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

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

describe('dot and matVecMul', () => {
  it('computes the dot product', () => {
    expect(dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });
  it('multiplies a matrix by a vector', () => {
    const m: Matrix = [
      [1, 0],
      [0, 1]
    ];
    expect(matVecMul(m, [7, 9])).toEqual([7, 9]);
    expect(matVecMul([[2, 3], [4, 5]], [1, 1])).toEqual([5, 9]);
  });
});

describe('invertMatrix', () => {
  it('inverts a known 2x2 matrix', () => {
    // A = [[4,7],[2,6]], det = 10, A^-1 = [[0.6,-0.7],[-0.2,0.4]]
    const inv = invertMatrix([[4, 7], [2, 6]]);
    expect(inv).not.toBeNull();
    expect(inv![0][0]).toBeCloseTo(0.6, 10);
    expect(inv![0][1]).toBeCloseTo(-0.7, 10);
    expect(inv![1][0]).toBeCloseTo(-0.2, 10);
    expect(inv![1][1]).toBeCloseTo(0.4, 10);
  });

  it('yields the identity when multiplied by the original', () => {
    const A: Matrix = [[3, 1, 2], [1, 4, 1], [2, 1, 5]];
    const inv = invertMatrix(A)!;
    for (let i = 0; i < 3; i++) {
      const row = matVecMul(A, inv.map((r) => r[i])); // A * (i-th column of inv)
      for (let j = 0; j < 3; j++) {
        expect(row[j]).toBeCloseTo(i === j ? 1 : 0, 8);
      }
    }
  });

  it('returns null for a singular matrix', () => {
    expect(invertMatrix([[1, 2], [2, 4]])).toBeNull();
  });
});

describe('weightsMinVariance', () => {
  it('weights inversely to variance for a diagonal covariance', () => {
    // Sigma = diag(1, 4) → z = inv*ones = [1, 0.25], normalized → [0.8, 0.2]
    const w = weightsMinVariance([[1, 0], [0, 4]])!;
    expect(w[0]).toBeCloseTo(0.8, 10);
    expect(w[1]).toBeCloseTo(0.2, 10);
    expect(sum(w)).toBeCloseTo(1, 10);
  });

  it('returns null for a singular covariance', () => {
    expect(weightsMinVariance([[1, 1], [1, 1]])).toBeNull();
  });
});

describe('weightsTangency', () => {
  it('produces weights that sum to 1', () => {
    const w = weightsTangency([0.1, 0.2], [[0.04, 0], [0, 0.09]], 0.02)!;
    expect(sum(w)).toBeCloseTo(1, 10);
  });
});

describe('weightsTargetReturn', () => {
  it('hits the target return with weights summing to 1', () => {
    const mu = [0.1, 0.2];
    const Sigma: Matrix = [[0.04, 0.0], [0.0, 0.09]];
    const target = 0.15;
    const w = weightsTargetReturn(mu, Sigma, target)!;
    expect(portfolioReturn(w, mu)).toBeCloseTo(target, 8);
    expect(sum(w)).toBeCloseTo(1, 8);
  });
});

describe('portfolioVariance and portfolioReturn', () => {
  it('computes w·μ for the return', () => {
    expect(portfolioReturn([0.5, 0.5], [0.1, 0.3])).toBeCloseTo(0.2, 10);
  });
  it('computes wᵀΣw for the variance', () => {
    // identity Sigma → sum of squared weights
    expect(portfolioVariance([0.6, 0.8], [[1, 0], [0, 1]])).toBeCloseTo(0.36 + 0.64, 10);
  });
});

describe('projectToSimplex', () => {
  it('leaves a valid simplex vector unchanged', () => {
    expect(projectToSimplex([0.5, 0.3, 0.2])).toEqual([0.5, 0.3, 0.2]);
  });
  it('projects an out-of-bounds vector onto the simplex', () => {
    const p = projectToSimplex([0.9, 0.7, -0.3]);
    expect(sum(p)).toBeCloseTo(1, 10);
    expect(Math.min(...p)).toBeGreaterThanOrEqual(0);
  });
  it('keeps a unit basis vector on the simplex', () => {
    expect(projectToSimplex([1, 0, 0])).toEqual([1, 0, 0]);
  });
});
