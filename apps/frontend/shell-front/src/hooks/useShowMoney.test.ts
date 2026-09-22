import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const getShowMoney = vi.fn();
vi.mock('../services/profileApi', () => ({ profileApi: { getShowMoney: () => getShowMoney() } }));

import { FEATURES_CHANGED_EVENT, useShowMoney } from './useShowMoney';

afterEach(() => vi.clearAllMocks());

describe('useShowMoney', () => {
  it('is off until the profile says otherwise', async () => {
    let resolve!: (value: boolean) => void;
    getShowMoney.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useShowMoney('u1'));

    expect(result.current.showMoney).toBe(false);
    await act(async () => resolve(true));
    expect(result.current.showMoney).toBe(true);
  });

  it('stays off when the profile cannot be read', async () => {
    getShowMoney.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useShowMoney('u1'));

    await waitFor(() => expect(getShowMoney).toHaveBeenCalled());
    expect(result.current.showMoney).toBe(false);
  });

  it('asks nobody while signed out', () => {
    const { result } = renderHook(() => useShowMoney(undefined));
    expect(getShowMoney).not.toHaveBeenCalled();
    expect(result.current.showMoney).toBe(false);
  });

  it('goes back to off when someone else signs in on the device', async () => {
    getShowMoney.mockResolvedValueOnce(true).mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = renderHook(({ id }) => useShowMoney(id), { initialProps: { id: 'u-tom' } });
    await waitFor(() => expect(result.current.showMoney).toBe(true));

    rerender({ id: 'u-irja' });

    expect(result.current.showMoney).toBe(false);
  });

  it('follows the Features page as soon as it changes, without a reload', async () => {
    getShowMoney.mockResolvedValue(false);
    const { result } = renderHook(() => useShowMoney('u1'));
    await waitFor(() => expect(getShowMoney).toHaveBeenCalled());

    act(() => {
      window.dispatchEvent(new CustomEvent(FEATURES_CHANGED_EVENT, { detail: { showMoney: true } }));
    });

    expect(result.current.showMoney).toBe(true);
  });
});
