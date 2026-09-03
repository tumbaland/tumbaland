import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/statistics', () => ({
  getTrends: vi.fn()
}));

import { getTrends } from '../services/statistics';
import { useTrends } from './useTrends';

const mockedGetTrends = getTrends as unknown as ReturnType<typeof vi.fn>;

const result = { windowDays: 30, types: [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

it('fetches trends for the given window and scope', async () => {
  mockedGetTrends.mockResolvedValue(result);
  const { result: hook } = renderHook(() => useTrends(30, 'g1'));

  expect(hook.current.loading).toBe(true);
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(mockedGetTrends).toHaveBeenCalledWith(30, 'g1');
  expect(hook.current.trends).toEqual(result);
  expect(hook.current.loading).toBe(false);
  expect(hook.current.error).toBeNull();
});

it('refetches when the window changes', async () => {
  mockedGetTrends.mockResolvedValue(result);
  const { rerender } = renderHook(({ days }) => useTrends(days), {
    initialProps: { days: 30 }
  });

  await act(async () => {
    await vi.runAllTimersAsync();
  });
  rerender({ days: 7 });
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(mockedGetTrends).toHaveBeenNthCalledWith(1, 30, undefined);
  expect(mockedGetTrends).toHaveBeenNthCalledWith(2, 7, undefined);
});

it('sets an error message when the fetch fails', async () => {
  mockedGetTrends.mockRejectedValue(new Error('boom'));
  const { result: hook } = renderHook(() => useTrends(30));

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(hook.current.error).toBe('boom');
  expect(hook.current.trends).toBeNull();
});

it('falls back to a generic message for a non-Error rejection', async () => {
  mockedGetTrends.mockRejectedValue('nope');
  const { result: hook } = renderHook(() => useTrends(30));

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(hook.current.error).toBe('Failed to fetch trends');
});

it('refetches on demand', async () => {
  mockedGetTrends.mockResolvedValue(result);
  const { result: hook } = renderHook(() => useTrends(30));

  await act(async () => {
    await vi.runAllTimersAsync();
  });
  await act(async () => {
    await hook.current.refetch();
  });

  expect(mockedGetTrends).toHaveBeenCalledTimes(2);
});
