import { downsample } from './downsample';

const series = (n: number) => Array.from({ length: n }, (_, i) => i);

it('leaves a short series alone', () => {
  const data = series(10);
  expect(downsample(data, 500)).toBe(data);
});

it('thins a long series to about the limit, evenly', () => {
  const result = downsample(series(1000), 100);
  expect(result.length).toBeLessThanOrEqual(101);
  expect(result.slice(0, 3)).toEqual([0, 10, 20]);
});

it('always keeps the last point', () => {
  const data = series(1001);
  expect(downsample(data, 100).at(-1)).toBe(1000);
});

it('does not repeat the last point when the step lands on it', () => {
  const result = downsample(series(1001), 100);
  expect(result.filter((n) => n === 1000)).toHaveLength(1);
});
