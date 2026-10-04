import { renderHook, act } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('../services/statistics', () => ({
  getStreaks: vi.fn()
}));

import { getStreaks } from '../services/statistics';
import { useStreaks } from './useStreaks';

const mockedGetStreaks = getStreaks as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

it('fetches streaks for the given scope', async () => {
  mockedGetStreaks.mockResolvedValue({ currentStreak: 3 });
  const { result } = renderHook(() => useStreaks('g1'));

  expect(result.current.loading).toBe(true);
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(mockedGetStreaks).toHaveBeenCalledWith('g1');
  expect(result.current.streaks).toEqual({ currentStreak: 3 });
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
});

it('sets an error message when the fetch fails', async () => {
  mockedGetStreaks.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useStreaks());

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(result.current.error).toBe('boom');
  expect(result.current.streaks).toBeNull();
});

it('falls back to a generic message for a non-Error rejection', async () => {
  mockedGetStreaks.mockRejectedValue('nope');
  const { result } = renderHook(() => useStreaks());

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(result.current.error).toBe('Failed to fetch streaks');
});

it('refetches on demand', async () => {
  mockedGetStreaks.mockResolvedValue({ currentStreak: 1 });
  const { result } = renderHook(() => useStreaks());

  await act(async () => {
    await vi.runAllTimersAsync();
  });
  await act(async () => {
    await result.current.refetch();
  });

  expect(mockedGetStreaks).toHaveBeenCalledTimes(2);
});
