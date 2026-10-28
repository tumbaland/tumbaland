import { useRef, useState, type TouchEvent } from 'react';

/** Two taps closer together than this are a double tap. */
const DOUBLE_TAP_MS = 300;
/** A double click this soon after a touch is the browser repeating the double tap. */
const TOUCH_CLICK_GAP_MS = 800;
/** How far a finger moves before a touch is judged a swipe or a scroll. */
const SWIPE_DECIDE_PX = 10;
/** How far a bubble must be swiped to reply, and how far it can go. */
export const SWIPE_REPLY_PX = 56;
const SWIPE_MAX_PX = 72;
/** How long a touch must be held before it counts as a long press. */
const LONG_PRESS_MS = 450;

interface UseBubbleGesturesOptions {
  messageId: string;
  /** Whether a long press may open the reaction picker. */
  canPick: boolean;
  /** Whether a swipe may start a reply. */
  canReply: boolean;
  /** Whether a double tap may leave a heart. */
  canLove: boolean;
  onPickEmoji: (messageId: string, anchor: HTMLElement) => void;
  onReply?: (messageId: string) => void;
  onLove?: (messageId: string) => void;
}

/**
 * What a finger can do to a message bubble: hold for the reaction picker, swipe
 * right to reply, double tap for a heart. They share one touch, so they are
 * decided together: a hold is not also a tap, and a swipe is not either.
 */
export function useBubbleGestures({
  messageId,
  canPick,
  canReply,
  canLove,
  onPickEmoji,
  onReply,
  onLove
}: UseBubbleGesturesOptions) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipe = useRef<{ x: number; y: number; sideways: boolean | null; held: boolean } | null>(null);
  const [dragX, setDragX] = useState(0);
  /** When the last tap landed, for telling a double tap from two separate ones. */
  const lastTap = useRef(0);
  /** When a finger last left the bubble. A browser may follow a double tap with a double click. */
  const lastTouchEnd = useRef(0);
  /** Bumped for each heart, so the burst plays again on a second double tap. */
  const [hearts, setHearts] = useState(0);

  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  /**
   * Touch has no hover, so the reaction button beside the bubble can never
   * appear there. A long press is the gesture every other chat app uses for
   * the same thing.
   */
  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (touch) swipe.current = { x: touch.clientX, y: touch.clientY, sideways: null, held: false };
    if (!canPick) return;
    const anchor = event.currentTarget;
    pressTimer.current = setTimeout(() => {
      if (swipe.current) swipe.current.held = true;
      onPickEmoji(messageId, anchor);
    }, LONG_PRESS_MS);
  };

  /**
   * Swipe right to reply, as in other chat apps. Decided on the first few
   * pixels: a mostly-vertical move is a scroll and is left alone, so reading
   * up the thread never drags a bubble. Any move also cancels the hold, so a
   * scroll never opens the picker.
   */
  const onTouchMove = (event: TouchEvent<HTMLElement>) => {
    cancelPress();
    const start = swipe.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (start.sideways === null && Math.hypot(dx, dy) > SWIPE_DECIDE_PX) {
      start.sideways = canReply && dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.5;
    }
    if (start.sideways) setDragX(Math.max(0, Math.min(dx, SWIPE_MAX_PX)));
  };

  const onTouchCancel = () => {
    cancelPress();
    swipe.current = null;
    setDragX(0);
  };

  const love = () => {
    if (!onLove || !canLove) return;
    onLove(messageId);
    setHearts((count) => count + 1);
  };

  const onTouchEnd = () => {
    lastTouchEnd.current = Date.now();
    cancelPress();
    if (dragX >= SWIPE_REPLY_PX) onReply?.(messageId);
    // A tap is a touch that neither moved nor was held for the menu.
    const tapped = swipe.current !== null && swipe.current.sideways === null && !swipe.current.held;
    swipe.current = null;
    setDragX(0);
    if (!tapped) return;
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      love();
    } else {
      lastTap.current = now;
    }
  };

  const onDoubleClick = () => {
    if (Date.now() - lastTouchEnd.current < TOUCH_CLICK_GAP_MS) return;
    // A double click also selects the word under it; the heart is what was meant.
    window.getSelection()?.removeAllRanges();
    love();
  };

  return {
    dragX,
    hearts,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, onDoubleClick }
  };
}
