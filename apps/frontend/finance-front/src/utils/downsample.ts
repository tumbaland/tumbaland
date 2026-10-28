/**
 * At most about `maxPoints` evenly spaced points of a series, for a chart that
 * cannot draw more than that legibly. The last point is always kept, so the
 * line ends where the data does.
 */
export function downsample<T>(data: T[], maxPoints: number = 500): T[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const result: T[] = [];
  for (let i = 0; i < data.length; i += step) {
    result.push(data[i]);
  }
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  return result;
}
