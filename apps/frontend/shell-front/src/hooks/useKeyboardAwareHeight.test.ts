import { act, renderHook } from '@testing-library/react';
import { vi } from 'vite-plus/test';
import { useKeyboardAwareHeight } from './useKeyboardAwareHeight';

function fakeViewport(height: number, scale = 1) {
  const target = new EventTarget();
  return Object.assign(target, { height, scale });
}

function setViewport(viewport: ReturnType<typeof fakeViewport> | undefined) {
  Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
}

beforeEach(() => {
  // Run the frame at once, so a test reads the result of the resize it just made.
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  window.scrollTo = vi.fn() as never;
});

afterEach(() => {
  vi.unstubAllGlobals();
  setViewport(undefined);
});

it('is the whole screen where there is no visual viewport to ask', () => {
  setViewport(undefined);
  expect(renderHook(() => useKeyboardAwareHeight()).result.current).toBe('100dvh');
});

it('is the whole screen while no keyboard is up', () => {
  setViewport(fakeViewport(800));
  expect(renderHook(() => useKeyboardAwareHeight()).result.current).toBe('100dvh');
});

it('is only what is above the keyboard while one is up, and undoes the scroll iOS made', () => {
  Object.defineProperty(window, 'scrollY', { value: 120, configurable: true });
  setViewport(fakeViewport(500));

  const { result } = renderHook(() => useKeyboardAwareHeight());

  expect(result.current).toBe('500px');
  expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
});

it('ignores a browser bar settling, which is not a keyboard', () => {
  setViewport(fakeViewport(760));
  expect(renderHook(() => useKeyboardAwareHeight()).result.current).toBe('100dvh');
});

it('does not follow a pinch zoom', () => {
  setViewport(fakeViewport(300, 2));
  expect(renderHook(() => useKeyboardAwareHeight()).result.current).toBe('100dvh');
});

it('follows the keyboard coming and going, and stops listening on unmount', () => {
  const viewport = fakeViewport(800);
  setViewport(viewport);
  const remove = vi.spyOn(viewport, 'removeEventListener');
  const { result, unmount } = renderHook(() => useKeyboardAwareHeight());
  expect(result.current).toBe('100dvh');

  act(() => {
    viewport.height = 450;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(result.current).toBe('450px');

  act(() => {
    viewport.height = 800;
    viewport.dispatchEvent(new Event('resize'));
  });
  expect(result.current).toBe('100dvh');

  unmount();
  expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
});
