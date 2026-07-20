import { useRef } from 'react';

const SWIPE_THRESHOLD_PX = 50;
// Swipes that drift too far vertically are treated as scrolling, not paging.
const MAX_VERTICAL_RATIO = 0.5;

export interface SwipeHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
}

/** Swipe left -> onSwipeLeft (next), swipe right -> onSwipeRight (previous). */
export const useSwipeNavigation = (onSwipeLeft: () => void, onSwipeRight: () => void): SwipeHandlers => {
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(deltaY) > Math.abs(deltaX) * MAX_VERTICAL_RATIO) return;

    if (deltaX < 0) {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
  };

  return { onTouchStart, onTouchEnd };
};
