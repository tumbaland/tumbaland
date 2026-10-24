import { ApiError } from '@tumbaland/frontend-core';
import { queryClient } from './queryClient';

describe('queryClient retry policy', () => {
  const retry = queryClient.getDefaultOptions().queries?.retry as (failureCount: number, error: unknown) => boolean;

  it('does not retry a 4xx response', () => {
    expect(retry(0, new ApiError(404, 'not found'))).toBe(false);
    expect(retry(0, new ApiError(402, 'plan limit'))).toBe(false);
  });

  it('retries a 5xx response', () => {
    expect(retry(0, new ApiError(503, 'unavailable'))).toBe(true);
  });

  it('does not take a 4 in the message for a 4xx status', () => {
    expect(retry(0, new Error('Failed to fetch 24 items'))).toBe(true);
    expect(retry(0, new ApiError(500, 'Failed to fetch 24 items'))).toBe(true);
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
