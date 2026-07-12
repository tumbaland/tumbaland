import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../services/statistics', () => ({
  getStatistics: vi.fn()
}));

import { getStatistics } from '../services/statistics';
import { useStatistics } from './useStatistics';

const mockedGetStatistics = getStatistics as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

it('fetches statistics with the given timeframe/groupId, defaulting timeframe to "all"', async () => {
  mockedGetStatistics.mockResolvedValue({ totalHours: 5 });
  const { result } = renderHook(() => useStatistics());

  expect(result.current.loading).toBe(true);
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(result.current.statistics).toEqual({ totalHours: 5 });
  expect(mockedGetStatistics).toHaveBeenCalledWith('all', undefined);
});

it('passes an explicit timeframe and groupId', async () => {
  mockedGetStatistics.mockResolvedValue({ totalHours: 1 });
  renderHook(() => useStatistics({ timeframe: 'week', groupId: 'g1' }));

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(mockedGetStatistics).toHaveBeenCalledWith('week', 'g1');
});

it('sets an error message when the fetch fails', async () => {
  mockedGetStatistics.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useStatistics());

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(result.current.error).toBe('boom');
  expect(result.current.loading).toBe(false);
});

it('sets a generic error message for a non-Error rejection', async () => {
  mockedGetStatistics.mockRejectedValue('nope');
  const { result } = renderHook(() => useStatistics());

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(result.current.error).toBe('Failed to fetch statistics');
});

it('refetches on demand', async () => {
  mockedGetStatistics.mockResolvedValue({ totalHours: 1 });
  const { result } = renderHook(() => useStatistics());
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  await act(async () => {
    await result.current.refetch();
  });

  expect(mockedGetStatistics).toHaveBeenCalledTimes(2);
});

it('polls again after refreshInterval elapses, and stops on unmount', async () => {
  mockedGetStatistics.mockResolvedValue({ totalHours: 1 });
  const { unmount } = renderHook(() => useStatistics({ refreshInterval: 5000 }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(mockedGetStatistics.mock.calls.length).toBeGreaterThanOrEqual(2);

  const callsBeforeUnmount = mockedGetStatistics.mock.calls.length;
  unmount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(mockedGetStatistics.mock.calls.length).toBe(callsBeforeUnmount);
});

it('does not set up a polling interval when refreshInterval is not given', async () => {
  mockedGetStatistics.mockResolvedValue({ totalHours: 1 });
  renderHook(() => useStatistics());
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  const callsAfterInitial = mockedGetStatistics.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(mockedGetStatistics.mock.calls.length).toBe(callsAfterInitial);
});
