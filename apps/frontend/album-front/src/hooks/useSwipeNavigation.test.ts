import { renderHook } from '@testing-library/react';
import { useSwipeNavigation } from './useSwipeNavigation';

function touchEvent(x: number, y: number) {
  return { touches: [{ clientX: x, clientY: y }] } as unknown as React.TouchEvent;
}

function touchEndEvent(x: number, y: number) {
  return { changedTouches: [{ clientX: x, clientY: y }] } as unknown as React.TouchEvent;
}

function swipe(handlers: ReturnType<typeof useSwipeNavigation>, from: [number, number], to: [number, number]) {
  handlers.onTouchStart(touchEvent(...from));
  handlers.onTouchEnd(touchEndEvent(...to));
}

it('calls onSwipeLeft on a leftward swipe past the threshold', () => {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const { result } = renderHook(() => useSwipeNavigation(onSwipeLeft, onSwipeRight));

  swipe(result.current, [200, 100], [100, 100]); // deltaX = -100

  expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  expect(onSwipeRight).not.toHaveBeenCalled();
});

it('calls onSwipeRight on a rightward swipe past the threshold', () => {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const { result } = renderHook(() => useSwipeNavigation(onSwipeLeft, onSwipeRight));

  swipe(result.current, [100, 100], [200, 100]); // deltaX = +100

  expect(onSwipeRight).toHaveBeenCalledTimes(1);
  expect(onSwipeLeft).not.toHaveBeenCalled();
});

it('ignores a swipe shorter than the threshold', () => {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const { result } = renderHook(() => useSwipeNavigation(onSwipeLeft, onSwipeRight));

  swipe(result.current, [100, 100], [120, 100]); // deltaX = 20, below 50px threshold

  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(onSwipeRight).not.toHaveBeenCalled();
});

it('ignores a mostly-vertical drag (scroll), even past the horizontal threshold', () => {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const { result } = renderHook(() => useSwipeNavigation(onSwipeLeft, onSwipeRight));

  // deltaX = -60, deltaY = 40: |40| > |60| * 0.5 (30), so treated as scroll
  swipe(result.current, [200, 100], [140, 140]);

  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(onSwipeRight).not.toHaveBeenCalled();
});

it('allows a diagonal swipe within the vertical tolerance', () => {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const { result } = renderHook(() => useSwipeNavigation(onSwipeLeft, onSwipeRight));

  // deltaX = -60, deltaY = 20: |20| <= |60| * 0.5 (30), still a swipe
  swipe(result.current, [200, 100], [140, 120]);

  expect(onSwipeLeft).toHaveBeenCalledTimes(1);
});

it('does nothing on touchend without a preceding touchstart', () => {
  const onSwipeLeft = vi.fn();
  const onSwipeRight = vi.fn();
  const { result } = renderHook(() => useSwipeNavigation(onSwipeLeft, onSwipeRight));

  expect(() => result.current.onTouchEnd(touchEndEvent(0, 0))).not.toThrow();
  expect(onSwipeLeft).not.toHaveBeenCalled();
  expect(onSwipeRight).not.toHaveBeenCalled();
});
