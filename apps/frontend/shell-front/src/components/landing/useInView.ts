import { useEffect, useState } from 'react';

/**
 * Whether an element has been on screen yet, for the visuals that play once
 * and then stay at their end.
 *
 * Watched with an observer rather than by listening for scroll, for the same
 * reason LandingNav does: the landing page scrolls inside the shell Layout's
 * own container, so `window.scrollY` never moves and a scroll listener never
 * fires. An observer against the viewport is true whatever is doing the
 * scrolling.
 *
 * Where there is nothing to watch with, it is true from the start: the caller
 * then renders the finished state instead of an animation that never begins.
 *
 * Returns a callback ref, not an object ref, so the effect runs once the node
 * exists rather than on a null first pass.
 */
export function useInView(threshold = 0.3): [(node: Element | null) => void, boolean] {
  const [node, setNode] = useState<Element | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (records) => {
        if (records.some((record) => record.isIntersecting)) {
          setInView(true);
          // Once is enough: nothing here plays twice on its own.
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold]);

  return [setNode, inView];
}

export default useInView;
