import { useCallback, useEffect, useRef, useState } from 'react';
import { collageService } from '../services/collageService';

/** Where an item is mid-gesture. */
export interface MovingItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** Someone else's item in motion, as this screen follows it. */
export interface RemoteMotion {
  userId: string;
  name: string;
  item: MovingItem;
  /** Let go, and waiting for the save that puts it there for good. */
  released: boolean;
  at: number;
}

/**
 * Gap between position reports while dragging. Ten a second reads as smooth
 * once the other screen eases between them, and costs little.
 */
export const MOTION_INTERVAL_MS = 100;
/** A let-go item waits this long for its save before snapping back. */
const RELEASED_FOR_MS = 2500;
/** A drag with no word for this long is assumed abandoned (a closed tab). */
const SILENT_FOR_MS = 4000;

const geometry = (item: MovingItem): MovingItem => ({
  id: item.id,
  x: item.x,
  y: item.y,
  width: item.width,
  height: item.height,
  ...(item.rotation !== undefined ? { rotation: item.rotation } : {})
});

/**
 * Reports where the item this tab is moving is, while it moves, so the other
 * screen can follow it. Never saved: the save at the end of the gesture is
 * what counts. The last position is always sent, even when it falls between
 * reports, and letting go is said explicitly.
 */
export function useMotionReport({
  collageId,
  session,
  enabled,
  active,
  item
}: {
  collageId?: string;
  session: string;
  enabled: boolean;
  /** A drag, resize or turn is under way. */
  active: boolean;
  item: MovingItem | null | undefined;
}): void {
  const lastSent = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moving = useRef(false);
  const latestItem = useRef(item);

  useEffect(() => {
    latestItem.current = item;
    if (!enabled || !collageId) return;

    const send = (next: MovingItem | null) => {
      lastSent.current = Date.now();
      collageService.reportMoving(collageId, session, next).catch(() => undefined);
    };

    if (active && item) {
      moving.current = true;
      const wait = MOTION_INTERVAL_MS - (Date.now() - lastSent.current);
      if (wait <= 0) {
        if (trailing.current) clearTimeout(trailing.current);
        trailing.current = null;
        send(geometry(item));
      } else if (!trailing.current) {
        trailing.current = setTimeout(() => {
          trailing.current = null;
          if (moving.current && latestItem.current) send(geometry(latestItem.current));
        }, wait);
      }
    } else if (moving.current) {
      moving.current = false;
      if (trailing.current) clearTimeout(trailing.current);
      trailing.current = null;
      send(null);
    }
  }, [collageId, session, enabled, active, item]);

  useEffect(
    () => () => {
      if (trailing.current) clearTimeout(trailing.current);
    },
    []
  );
}

/**
 * Follows the other people's items while they move them.
 *
 * A position stays until the save that makes it permanent arrives (`settle`),
 * so a let-go photo does not jump back to where it started for the moment
 * between letting go and the save landing.
 */
export function useRemoteMotion() {
  const [motions, setMotions] = useState<Record<string, RemoteMotion>>({});

  const onMoving = useCallback((event: { userId: string; name: string; item: MovingItem | null }) => {
    setMotions((current) => {
      if (!event.item) {
        const known = current[event.userId];
        return known ? { ...current, [event.userId]: { ...known, released: true, at: Date.now() } } : current;
      }
      return {
        ...current,
        [event.userId]: { userId: event.userId, name: event.name, item: event.item, released: false, at: Date.now() }
      };
    });
  }, []);

  /** Their save arrived: the collage itself now has the item where they left it. */
  const settle = useCallback((userId: string) => {
    setMotions((current) => {
      if (!current[userId]) return current;
      const { [userId]: _settled, ...rest } = current;
      return rest;
    });
  }, []);

  // A save that never comes (it failed, or their tab closed mid-drag) must not
  // leave an item stuck where it was last seen.
  useEffect(() => {
    const sweep = setInterval(() => {
      setMotions((current) => {
        const now = Date.now();
        const kept = Object.values(current).filter(
          (motion) => now - motion.at < (motion.released ? RELEASED_FOR_MS : SILENT_FOR_MS)
        );
        return kept.length === Object.keys(current).length
          ? current
          : Object.fromEntries(kept.map((motion) => [motion.userId, motion]));
      });
    }, 1000);
    return () => clearInterval(sweep);
  }, []);

  return { motions: Object.values(motions), onMoving, settle };
}
