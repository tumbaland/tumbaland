import { useEffect, useState } from 'react';

/** Less than this is browser chrome settling, not a keyboard. */
const KEYBOARD_MIN_PX = 80;

/**
 * The height the app should take: the whole screen, or only the part above the
 * on-screen keyboard while one is up.
 *
 * Android resizes the page for the keyboard (index.html asks for
 * `interactive-widget=resizes-content`), so `100dvh` already shrinks there.
 * iOS does not: it lays the keyboard over the page and scrolls the whole page
 * up to keep the focused field in sight, which pushes the header and the
 * newest messages off the top of the screen. Sizing the app to the visual
 * viewport instead leaves nothing to scroll, so the composer sits on the
 * keyboard and the conversation stays visible above it.
 */
export function useKeyboardAwareHeight(): string {
  const [height, setHeight] = useState('100dvh');

  useEffect(() => {
    const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!viewport) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // A pinch zoom shrinks the visual viewport too. Resizing the app to
        // follow it would fight the zoom.
        if (viewport.scale > 1.01) return;

        const keyboard = window.innerHeight - viewport.height;
        if (keyboard > KEYBOARD_MIN_PX) {
          setHeight(`${Math.round(viewport.height)}px`);
          // Undo the scroll iOS already made to reveal the field.
          if (window.scrollY !== 0) window.scrollTo(0, 0);
        } else {
          setHeight('100dvh');
        }
      });
    };

    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    update();

    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  return height;
}
