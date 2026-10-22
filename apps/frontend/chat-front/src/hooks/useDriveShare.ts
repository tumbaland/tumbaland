import { useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi } from '../services/chatApi';
import { STALE_MS, currentPosition, keepScreenOn, positionError, toLivePosition } from '../services/live';
import type { LivePosition, LiveShare } from '../types';

export type DriveState = 'idle' | 'starting' | 'sharing' | 'stopping';

export interface UseDriveShareResult {
  state: DriveState;
  /** What stopped it or kept it from starting, in words for the person. */
  error: string | null;
  /** The phone's newest position, sent or not. */
  position: (LivePosition & { at: number }) | null;
  /** When the server last took a position. */
  lastSentAt: number | null;
  /** True while positions are not getting through: no signal, usually. */
  sendFailing: boolean;
  /** Whether the screen is being kept on: `unavailable` where the browser will not. */
  screen: 'on' | 'unavailable' | null;
  /** True while sharing a pin: one place that stays put, rather than following the GPS. */
  pinned: boolean;
  start: (options?: StartOptions) => Promise<void>;
  stop: () => Promise<void>;
}

export interface StartOptions {
  /** Marked on the map, with what it is. Left out, a share already running keeps the one it has. */
  destination?: { lat: number; lng: number; label?: string } | null;
  /**
   * Where to start from: the position the map already has, from the GPS or
   * marked by hand because the browser's guess was wrong (a computer has no
   * GPS and guesses from its connection). Saves waiting for the GPS again.
   */
  place?: { lat: number; lng: number; accuracy?: number | null } | null;
  /**
   * A pin: `place` shared as it is, for "come and get me here". The GPS is not
   * watched, the screen need not stay on, and nothing more is sent.
   */
  pin?: boolean;
  /** What the pin is: a saved place's name, or the address it is at. */
  pinLabel?: string | null;
}

/** How often the newest position is sent. Often enough to watch a car move; few enough for a phone on mobile data. */
const SEND_EVERY_MS = 5_000;
/** Sent this often even standing still, so the people watching can see it is still live. */
const HEARTBEAT_MS = 30_000;
/** Moves smaller than this are GPS wobble, not driving. */
const MIN_MOVE_M = 10;
/**
 * A phone standing still (a red light, parked outside) often stops reporting
 * positions at all. After this long without one it is asked outright, so the
 * heartbeat keeps going and nobody is told the screen may be off.
 */
const QUIET_GPS_MS = 25_000;

/** Metres between two points; plenty accurate over a few seconds of driving. */
function moved(a: LivePosition, b: LivePosition): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const x = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  const y = toRad(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/**
 * Drive mode: this phone's position, sent to a conversation every few
 * seconds while the page is on screen.
 *
 * The browser only gives positions while the page is visible, so the screen
 * is kept on where it can be, positions are sent again the moment the page
 * comes back, and the server keeps the share running between them. Leaving
 * the page stops sending but not the share: coming back can resume it, and
 * the people watching see how old the last position is meanwhile.
 *
 * `onShare` gets the share each time the server answers with it, and null
 * once it is over.
 */
export function useDriveShare(
  conversationId: string | undefined,
  onShare: (share: LiveShare | null) => void
): UseDriveShareResult {
  const [state, setState] = useState<DriveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<(LivePosition & { at: number }) | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [sendFailing, setSendFailing] = useState(false);
  const [screen, setScreen] = useState<'on' | 'unavailable' | null>(null);
  const [pinned, setPinned] = useState(false);
  const pinnedRef = useRef(false);

  const watchId = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lock = useRef<WakeLockSentinel | null>(null);
  const latest = useRef<LivePosition | null>(null);
  const latestAt = useRef(0);
  const active = useRef(false);
  const sending = useRef<number | null>(null);
  /** True while a position has been asked for outright and not yet answered. */
  const asking = useRef(false);
  const pendingStart = useRef<Promise<LiveShare> | null>(null);
  const pendingStop = useRef<Promise<void> | null>(null);
  const lastSent = useRef<{ at: number; position: LivePosition } | null>(null);
  const endsAt = useRef(0);
  /** Moves on with every start and stop, so an answer to an older one is ignored. */
  const attempt = useRef(0);
  const shareHandler = useRef(onShare);
  useEffect(() => {
    shareHandler.current = onShare;
  });

  /** Stops watching and sending here. The share on the server is left as it is. */
  const release = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void lock.current?.release().catch(() => undefined);
    lock.current = null;
    latest.current = null;
    asking.current = false;
    active.current = false;
    lastSent.current = null;
    pinnedRef.current = false;
    setPinned(false);
    setState('idle');
    setScreen(null);
    setSendFailing(false);
    setPosition(null);
    setLastSentAt(null);
  }, []);

  const send = useCallback(async () => {
    const next = latest.current;
    if (!conversationId || !next) return;
    const mine = attempt.current;
    if (sending.current === mine || (!pinnedRef.current && Date.now() - latestAt.current > STALE_MS)) return;
    sending.current = mine;
    try {
      const share = await chatApi.sendLivePosition(conversationId, next);
      if (mine !== attempt.current) return;
      lastSent.current = { at: Date.now(), position: next };
      setLastSentAt(Date.now());
      setSendFailing(false);
      shareHandler.current(share);
    } catch (cause) {
      if (mine !== attempt.current) return;
      if ((cause as { status?: number }).status === 404) {
        // Over on the server: its time ran out, or it was stopped elsewhere.
        attempt.current += 1;
        release();
        setError('Sharing has ended.');
        shareHandler.current(null);
        return;
      }
      logger.warn('Live position not sent', { error: (cause as Error).message });
      setSendFailing(true);
    } finally {
      if (sending.current === mine) sending.current = null;
    }
  }, [conversationId, release]);

  /**
   * Ends the share, on the server as well as here. Also what ends a share that
   * runs on without this phone sending, after a reload. Stopping twice is harmless.
   */
  const stop = useCallback(() => {
    if (pendingStop.current) return pendingStop.current;
    const mine = ++attempt.current;
    const starting = pendingStart.current;
    release();
    setError(null);
    if (!conversationId) return Promise.resolve();
    setState('stopping');
    const stopping = (async () => {
      try {
        // Delete after an outstanding start, so its late response cannot put the share back.
        await starting?.catch(() => undefined);
        await chatApi.stopLive(conversationId);
        if (mine === attempt.current) shareHandler.current(null);
      } catch {
        if (mine === attempt.current)
          setError('Could not stop sharing. Your last location may still be visible. Try Stop again.');
      } finally {
        if (mine === attempt.current) {
          if (pendingStart.current === starting) pendingStart.current = null;
          pendingStop.current = null;
          setState('idle');
        }
      }
    })();
    pendingStop.current = stopping;
    return stopping;
  }, [conversationId, release]);

  const tick = useCallback(() => {
    if (Date.now() >= endsAt.current) {
      void stop();
      return;
    }
    // Hidden, the browser is not giving positions anyway; nothing new to send.
    if (document.visibilityState !== 'visible') return;
    const next = latest.current;
    if (!next) return;
    const sent = lastSent.current;
    // A pin is sent once; again only if that first send did not get through.
    if (pinnedRef.current && sent) return;
    if (!pinnedRef.current && !asking.current && Date.now() - latestAt.current >= QUIET_GPS_MS) {
      const mine = attempt.current;
      asking.current = true;
      navigator.geolocation.getCurrentPosition(
        (fresh) => {
          asking.current = false;
          if (mine !== attempt.current) return;
          latest.current = toLivePosition(fresh.coords);
          latestAt.current = Date.now();
          setPosition({ ...latest.current, at: latestAt.current });
        },
        () => {
          // No fix right now; the watch may still bring one.
          asking.current = false;
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
      );
    }
    const due = !sent || moved(sent.position, next) >= MIN_MOVE_M || Date.now() - sent.at >= HEARTBEAT_MS;
    if (due) void send();
  }, [send, stop]);

  const start = useCallback(
    async ({ destination, place, pin = false, pinLabel = null }: StartOptions = {}) => {
      if (!conversationId || active.current || pendingStop.current) return;
      active.current = true;
      const mine = ++attempt.current;
      setError(null);
      setState('starting');

      let first: LivePosition;
      let share: LiveShare;
      try {
        // Asked first, so a blocked location never starts a share showing nothing.
        first = place
          ? { lat: place.lat, lng: place.lng, accuracy: place.accuracy ?? null, heading: null, speed: null }
          : toLivePosition((await currentPosition()).coords);
        if (mine !== attempt.current) return;
        const starting = chatApi.startLive(conversationId, {
          ...(destination === undefined ? {} : { destination }),
          fixed: pin,
          pinLabel: pin ? pinLabel : null
        });
        pendingStart.current = starting;
        share = await starting;
      } catch (cause) {
        if (mine !== attempt.current) return;
        setError(
          (cause as { status?: number }).status ? 'Could not start sharing. Try again.' : (cause as Error).message
        );
        setState('idle');
        active.current = false;
        return;
      } finally {
        if (mine === attempt.current) pendingStart.current = null;
      }
      if (mine !== attempt.current) return;

      shareHandler.current(share);
      endsAt.current = new Date(share.endsAt).getTime();
      latest.current = first;
      latestAt.current = Date.now();
      setPosition({ ...first, at: Date.now() });
      pinnedRef.current = pin;
      setPinned(pin);
      void send();

      // A pin stays where it was put: the GPS would only move it.
      if (!pin)
        watchId.current = navigator.geolocation.watchPosition(
          (next) => {
            if (mine !== attempt.current) return;
            latest.current = toLivePosition(next.coords);
            latestAt.current = Date.now();
            setPosition({ ...latest.current, at: Date.now() });
          },
          (failure) => {
            if (mine !== attempt.current) return;
            // A blocked location ends it; losing the signal in a tunnel does not.
            if (failure.code === 1) {
              void stop();
              setError(positionError(failure));
            }
          },
          { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 }
        );
      timer.current = setInterval(tick, SEND_EVERY_MS);
      setState('sharing');

      // Only a live share needs the page on screen to keep sending.
      if (pin) return;
      const nextLock = await keepScreenOn();
      if (mine !== attempt.current) {
        void nextLock?.release().catch(() => undefined);
        return;
      }
      lock.current = nextLock;
      setScreen(nextLock ? 'on' : 'unavailable');
    },
    [conversationId, send, stop, tick]
  );

  // Back on screen: the wake lock went with the page and has to be asked for
  // again, and whatever happened meanwhile is sent at once.
  useEffect(() => {
    // A pin was sent once and needs neither.
    if (state !== 'sharing' || pinned) return;
    const mine = attempt.current;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void keepScreenOn().then((next) => {
        if (mine !== attempt.current) {
          void next?.release().catch(() => undefined);
          return;
        }
        void lock.current?.release().catch(() => undefined);
        lock.current = next;
        setScreen(next ? 'on' : 'unavailable');
      });
      void send();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [state, pinned, send]);

  // Leaving the conversation stops this phone sending, not the share.
  useEffect(() => {
    setError(null);
    return () => {
      attempt.current += 1;
      release();
      // A start abandoned while its request is in flight must not leave an empty share behind.
      if (pendingStart.current && !pendingStop.current && conversationId)
        void pendingStart.current
          .then(() => chatApi.stopLive(conversationId))
          .catch((cause: Error) => logger.warn('Abandoned location share cleanup failed', { error: cause.message }));
      pendingStart.current = null;
      pendingStop.current = null;
    };
  }, [conversationId, release]);

  return { state, error, position, lastSentAt, sendFailing, screen, pinned, start, stop };
}
