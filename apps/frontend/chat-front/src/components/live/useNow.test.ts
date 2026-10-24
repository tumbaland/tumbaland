import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';
import { useNow } from './useNow';

beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] }));
afterEach(() => vi.useRealTimers());

describe('useNow', () => {
  it('moves on with the clock, and stops when it is no longer shown', () => {
    vi.setSystemTime(1_000_000);
    const { result, unmount } = renderHook(() => useNow(5000));
    expect(result.current).toBe(1_000_000);

    void act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(1_005_000);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
