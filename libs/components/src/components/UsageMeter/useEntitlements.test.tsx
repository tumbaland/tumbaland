import { renderHook, waitFor, act } from '@testing-library/react';
import type { Entitlements } from '@tumbaland/frontend-core';
import { useEntitlements } from './useEntitlements';

function entitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    email: 'user@example.com',
    planCode: 'free',
    status: null,
    limits: {
      meters: { storageBytes: 1024, aiJobs: 25, trackedTickers: 3, seats: 1 },
      features: { cleanExport: false },
      retentionDays: 90
    },
    usage: { storageBytes: 512, aiJobs: 0, trackedTickers: 1, seats: 1 },
    ...overrides
  };
}

describe('useEntitlements', () => {
  it('loads once and exposes the result', async () => {
    const fetcher = vi.fn().mockResolvedValue(entitlements());

    const { result } = renderHook(() => useEntitlements(fetcher));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entitlements?.planCode).toBe('free');
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not refetch when the caller passes a fresh inline arrow each render', async () => {
    const fetcher = vi.fn().mockResolvedValue(entitlements());
    const { result, rerender } = renderHook(() => useEntitlements(() => fetcher()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender();
    rerender();

    // Depending on `fetcher` identity would loop forever against the inline
    // arrow every call site actually writes.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports failure as a null result, so a page can simply omit the meter', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('payment-service unreachable'));

    const { result } = renderHook(() => useEntitlements(fetcher));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entitlements).toBeNull();
    expect(result.current.error?.message).toBe('payment-service unreachable');
  });

  it('refetches on reload and clears a previous error', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue(entitlements({ planCode: 'family' }));

    const { result } = renderHook(() => useEntitlements(fetcher));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.entitlements?.planCode).toBe('family'));

    expect(result.current.error).toBeNull();
  });

  it('ignores a resolution that lands after unmount', async () => {
    let resolve!: (value: Entitlements) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise<Entitlements>(r => (resolve = r)));

    const { unmount } = renderHook(() => useEntitlements(fetcher));
    unmount();

    // Would warn about setting state on an unmounted component without the guard.
    await act(async () => {
      resolve(entitlements());
    });
  });
});
