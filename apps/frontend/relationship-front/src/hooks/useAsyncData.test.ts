import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vite-plus/test';
import { useAsyncData } from './useAsyncData';

vi.mock('@tumbaland/frontend-core', () => ({ logger: { error: vi.fn() } }));

/** A promise settled from outside, so a test decides the order answers arrive in. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useAsyncData', () => {
  it('loads on mount and reports the result', async () => {
    const { result } = renderHook(() => useAsyncData(async () => 'hello', []));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('reports the error message when the load fails', async () => {
    const { result } = renderHook(() =>
      useAsyncData(async () => {
        throw new Error('nope');
      }, [])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('nope');
    expect(result.current.data).toBeUndefined();
  });

  it('falls back to the given message for a rejection that is not an Error', async () => {
    const { result } = renderHook(() => useAsyncData(() => Promise.reject('x'), [], 'Could not load'));

    await waitFor(() => expect(result.current.error).toBe('Could not load'));
  });

  it('ignores an older request that finishes after a newer one', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const answers = [first, second];
    let call = 0;

    const { result, rerender } = renderHook(({ year }) => useAsyncData(() => answers[call++]!.promise, [year]), {
      initialProps: { year: 2025 }
    });
    rerender({ year: 2026 });

    await act(async () => {
      second.resolve('2026 numbers');
    });
    await act(async () => {
      first.resolve('2025 numbers');
    });

    expect(result.current.data).toBe('2026 numbers');
    expect(result.current.loading).toBe(false);
  });

  it('does not set state after it has unmounted', async () => {
    const pending = deferred<string>();
    const { result, unmount } = renderHook(() => useAsyncData(() => pending.promise, []));

    unmount();
    await act(async () => {
      pending.resolve('late');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('fetches again on reload', async () => {
    const load = vi.fn().mockResolvedValueOnce('one').mockResolvedValueOnce('two');
    const { result } = renderHook(() => useAsyncData(load, []));
    await waitFor(() => expect(result.current.data).toBe('one'));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data).toBe('two'));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
