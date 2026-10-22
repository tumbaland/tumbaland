import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { act, renderHook } from '@testing-library/react';

const api = vi.hoisted(() => ({ placeAt: vi.fn() }));
vi.mock('../services/chatApi', () => ({ chatApi: api }));

import { forgetPlaces, placeText, usePlaceAt } from './usePlaceAt';

beforeEach(() => {
  vi.useFakeTimers();
  forgetPlaces();
  api.placeAt.mockReset().mockResolvedValue({ name: 'Viru 4', detail: 'Kesklinn, Tallinn', lat: 59.43, lng: 24.76 });
});

afterEach(() => vi.useRealTimers());

const settle = () =>
  act(async () => {
    vi.advanceTimersByTime(700);
    await Promise.resolve();
    await Promise.resolve();
  });

describe('usePlaceAt', () => {
  it('asks once the point has stopped moving, and remembers the answer', async () => {
    const { result, rerender } = renderHook(({ point }) => usePlaceAt(point), {
      initialProps: { point: { lat: 59.43, lng: 24.76 } as { lat: number; lng: number } | null }
    });
    expect(result.current).toBeUndefined();

    await settle();
    expect(result.current).toMatchObject({ name: 'Viru 4' });

    rerender({ point: { lat: 59.5, lng: 24.8 } });
    rerender({ point: { lat: 59.43, lng: 24.76 } });
    expect(result.current).toMatchObject({ name: 'Viru 4' });
    expect(api.placeAt).toHaveBeenCalledTimes(1);
  });

  it('asks nothing for no point, and gives null when there is no address', async () => {
    api.placeAt.mockRejectedValue(new Error('offline'));
    const { result, rerender } = renderHook(({ point }) => usePlaceAt(point), {
      initialProps: { point: null as { lat: number; lng: number } | null }
    });
    expect(result.current).toBeNull();

    rerender({ point: { lat: 1, lng: 2 } });
    await settle();
    expect(result.current).toBeNull();
  });

  it('retries an address after a temporary request failure instead of caching the failure', async () => {
    api.placeAt.mockRejectedValueOnce(new Error('Too many requests'));
    const point = { lat: 59.43, lng: 24.76 };
    const { result, rerender } = renderHook(({ point }) => usePlaceAt(point), {
      initialProps: { point: point as typeof point | null }
    });
    await settle();
    expect(result.current).toBeNull();
    rerender({ point: null });
    rerender({ point });
    await settle();
    expect(api.placeAt).toHaveBeenCalledTimes(2);
    expect(result.current).toMatchObject({ name: 'Viru 4' });
  });
});

describe('placeText', () => {
  it('gives the street and the first part of the rest, or the coordinates', () => {
    expect(placeText({ name: 'Viru 4', detail: 'Kesklinn, Tallinn', lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(
      'Viru 4, Kesklinn'
    );
    expect(placeText(null, { lat: 59.437123, lng: 24.7536 })).toBe('59.43712, 24.75360');
  });
});
