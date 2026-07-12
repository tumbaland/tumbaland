import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { usePerformanceOptimizations } from './usePerformanceOptimizations';

const setUserAgent = (ua: string) => {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
};

afterEach(() => {
  setUserAgent('');
});

it('detects a desktop, non-iOS, non-reduced-motion environment by default', () => {
  setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)');
  const { result } = renderHook(() => usePerformanceOptimizations());

  expect(result.current.isMobile).toBe(false);
  expect(result.current.isIOS).toBe(false);
  expect(result.current.prefersReducedMotion).toBe(false);
  // hasLowMemory/isSlowConnection are `undefined` (not `false`) when the navigator APIs are
  // absent, since they're chained with `&&`/`||` rather than coerced to boolean.
  expect(result.current.isLowEndDevice).toBeFalsy();
});

it('detects an iPhone as mobile and iOS', () => {
  setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
  const { result } = renderHook(() => usePerformanceOptimizations());

  expect(result.current.isMobile).toBe(true);
  expect(result.current.isIOS).toBe(true);
});

it('detects a low-end device from an old Android user agent', () => {
  setUserAgent('Mozilla/5.0 (Linux; Android 4.4.2)');
  const { result } = renderHook(() => usePerformanceOptimizations());

  expect(result.current.isLowEndDevice).toBe(true);
});

it('reacts to a reduced-motion preference change', () => {
  let changeHandler: (() => void) | null = null;
  const matches = { current: false };
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches.current;
    },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, handler: () => void) => {
      changeHandler = handler;
    },
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;

  const { result } = renderHook(() => usePerformanceOptimizations());
  expect(result.current.prefersReducedMotion).toBe(false);

  matches.current = true;
  act(() => {
    changeHandler?.();
  });

  expect(result.current.prefersReducedMotion).toBe(true);
});

it('unregisters listeners on unmount', () => {
  const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
  const { unmount } = renderHook(() => usePerformanceOptimizations());
  unmount();
  expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
});
