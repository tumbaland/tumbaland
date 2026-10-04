import { renderHook, act } from '@testing-library/react';
import { vi } from 'vite-plus/test';

vi.mock('../services/statistics', () => ({
  getMilestones: vi.fn()
}));

import { getMilestones } from '../services/statistics';
import { useMilestones } from './useMilestones';

const mockedGetMilestones = getMilestones as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => vi.useRealTimers());

it('fetches milestones for the given scope', async () => {
  mockedGetMilestones.mockResolvedValue({ recent: [], upcoming: [] });
  const { result } = renderHook(() => useMilestones('g1'));

  expect(result.current.loading).toBe(true);
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(mockedGetMilestones).toHaveBeenCalledWith('g1');
  expect(result.current.milestones).toEqual({ recent: [], upcoming: [] });
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
});

it('sets an error message when the fetch fails', async () => {
  mockedGetMilestones.mockRejectedValue(new Error('boom'));
  const { result } = renderHook(() => useMilestones());

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(result.current.error).toBe('boom');
  expect(result.current.milestones).toBeNull();
});

it('falls back to a generic message for a non-Error rejection', async () => {
  mockedGetMilestones.mockRejectedValue('nope');
  const { result } = renderHook(() => useMilestones());

  await act(async () => {
    await vi.runAllTimersAsync();
  });

  expect(result.current.error).toBe('Failed to fetch milestones');
});

it('refetches on demand', async () => {
  mockedGetMilestones.mockResolvedValue({ recent: [], upcoming: [] });
  const { result } = renderHook(() => useMilestones());

  await act(async () => {
    await vi.runAllTimersAsync();
  });
  await act(async () => {
    await result.current.refetch();
  });

  expect(mockedGetMilestones).toHaveBeenCalledTimes(2);
});
