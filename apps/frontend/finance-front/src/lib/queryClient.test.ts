import { queryClient } from './queryClient';

describe('queryClient retry policy', () => {
  const retry = queryClient.getDefaultOptions().queries?.retry as (failureCount: number, error: unknown) => boolean;

  it('does not retry on an error whose message contains a 4xx-shaped code', () => {
    expect(retry(0, new Error('HTTP error! status: 404'))).toBe(false);
  });

  it('retries non-4xx errors up to 3 times', () => {
    const error = new Error('network error');
    expect(retry(0, error)).toBe(true);
    expect(retry(2, error)).toBe(true);
    expect(retry(3, error)).toBe(false);
  });

  it('retries when the thrown value is not an Error instance', () => {
    expect(retry(0, 'plain string error')).toBe(true);
  });
});
