import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@tumbaland/frontend-core';
import { CollageDoc } from '../components/collage/collageDoc';
import {
  applyDocChange,
  applyServerChanges,
  diffDocs,
  rebase,
  ServerChange,
  toServerChanges
} from '../components/collage/collageChanges';
import { collageService } from '../services/collageService';

export type SaveStatus = 'saved' | 'saving' | 'retrying';

/** Quiet time after the last edit before it is sent. */
export const AUTOSAVE_DELAY_MS = 600;
/** Waits between attempts after a failed save, the last repeating. */
const RETRY_DELAYS_MS = [2000, 5000, 10_000, 30_000];

export interface UseCollageSyncOptions {
  collageId?: string;
  doc: CollageDoc | null;
  /** The revision the collage was loaded at. */
  revision?: number;
  /** This tab, so the server does not echo its own changes back to it. */
  session?: string;
  /** True during a drag: nothing is sent until the photo is let go. */
  paused: boolean;
  /**
   * Set when the stored collage predates item ids. Its first save writes the
   * whole thing once, so every later change has an id to name. Answers with
   * the revision it was stored at, when it knows it.
   */
  saveWhole?: (doc: CollageDoc) => Promise<number | undefined>;
  /** The collage as the server has it now, for catching up after a gap. */
  fetchLatest?: () => Promise<{ doc: CollageDoc; revision: number }>;
  /**
   * Someone else's changes arrived: `incoming` is `base` with them applied.
   * The editor puts its own unsaved work back on top.
   */
  onIncoming?: (base: CollageDoc, incoming: CollageDoc) => void;
}

interface Incoming {
  revision: number;
  changes: ServerChange[];
}

/**
 * Keeps a collage in step with the server, in both directions.
 *
 * Out: compares the collage with what the server last confirmed and sends
 * only what changed, a moment after the last edit. A failed save keeps
 * trying; the next attempt sends everything since the last one that worked.
 *
 * In: applies what other people saved, in the order the server applied it.
 * That order is the whole difficulty. When their change and yours cross in
 * flight, the server's revision numbers say whose landed first, and applying
 * them in any other order leaves the two screens showing different collages.
 * So incoming changes wait while a save of ours is on its way, and are
 * applied either side of it by revision. Anything that cannot be placed that
 * way is fixed by fetching the collage whole.
 */
export function useCollageSync({
  collageId,
  doc,
  revision,
  session,
  paused,
  saveWhole,
  fetchLatest,
  onIncoming
}: UseCollageSyncOptions) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SaveStatus>('saved');

  /** The collage as the server last confirmed it. */
  const synced = useRef<CollageDoc | null>(null);
  /** The editor's collage, including anything not yet sent. */
  const latest = useRef<CollageDoc | null>(doc);
  /** A save or a catch-up under way. Incoming changes wait for it. */
  const busy = useRef<Promise<unknown> | null>(null);
  const waiting = useRef<Incoming[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failures = useRef(0);
  const wholePending = useRef(false);
  const savedAny = useRef(false);

  /** Every revision up to this one is in `synced`. */
  const included = useRef(revision ?? 0);
  /** Revisions past `included` that are in `synced` too, out of order. */
  const applied = useRef(new Set<number>());
  /** The newest revision this tab saved itself. */
  const newestOwn = useRef(0);

  const pausedRef = useRef(paused);
  const saveWholeRef = useRef(saveWhole);
  const fetchLatestRef = useRef(fetchLatest);
  const onIncomingRef = useRef(onIncoming);
  const queryClientRef = useRef(queryClient);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const catchUpRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    saveWholeRef.current = saveWhole;
    fetchLatestRef.current = fetchLatest;
    onIncomingRef.current = onIncoming;
    queryClientRef.current = queryClient;
  }, [saveWhole, fetchLatest, onIncoming, queryClient]);

  const markIncluded = (rev: number) => {
    if (rev <= included.current) return;
    applied.current.add(rev);
    while (applied.current.has(included.current + 1)) {
      applied.current.delete(included.current + 1);
      included.current += 1;
    }
  };

  const newestKnown = () => Math.max(included.current, newestOwn.current, ...applied.current);

  /**
   * Whether the editor has anything the server does not. Checked by content,
   * not identity: bringing someone else's change in rebuilds the editor's copy
   * as a new object, and treating that as unsaved would start a save with
   * nothing in it. An equal copy is adopted as the confirmed one.
   */
  const hasUnsent = (): boolean => {
    const next = latest.current;
    const base = synced.current;
    if (!next || !base || next === base) return false;
    if (diffDocs(base, next)) return true;
    synced.current = next;
    return false;
  };

  /** Replace the confirmed collage, and move the editor's work onto it. */
  const bringIn = (incoming: CollageDoc) => {
    const base = synced.current;
    if (!base) return;
    synced.current = incoming;
    // Straight away, not on the next render: a save firing in between would
    // otherwise diff the new copy against the old one and send their change
    // back as a reversal.
    if (latest.current) latest.current = rebase(latest.current, base, incoming);
    onIncomingRef.current?.(base, incoming);
  };

  /** Apply one incoming batch now. False when it cannot be placed and a catch-up is needed. */
  const absorb = (event: Incoming): boolean => {
    if (event.revision <= included.current || applied.current.has(event.revision)) return true;
    // Older than a save of ours that is already in: the server applied theirs
    // first, but ours is already folded in here. Fetching is the honest fix.
    if (event.revision < newestOwn.current) return false;
    if (!synced.current) return true;
    bringIn(applyServerChanges(synced.current, event.changes));
    markIncluded(event.revision);
    return true;
  };

  /** Apply what waited, in order; true if any of it needs a catch-up. */
  const drain = (which: (event: Incoming) => boolean = () => true): boolean => {
    const ready = waiting.current.filter(which).sort((a, b) => a.revision - b.revision);
    waiting.current = waiting.current.filter((event) => !which(event));
    return ready.map(absorb).includes(false);
  };

  const schedule = useCallback((delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      // Mid-drag, the photo is not where it will end up. The end of the drag
      // schedules this again.
      if (!pausedRef.current) void flushRef.current();
    }, delay);
  }, []);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    while (busy.current) await busy.current;

    if (!collageId || !latest.current || !synced.current) return true;
    if (!wholePending.current && !hasUnsent()) {
      // Nothing to send, whatever happened before: a failed save whose change
      // was since undone is not still waiting to be saved.
      failures.current = 0;
      setStatus('saved');
      return true;
    }
    const next = latest.current;
    const base = synced.current;

    setStatus(failures.current > 0 ? 'retrying' : 'saving');
    const attempt = (async (): Promise<boolean> => {
      let needCatchUp = false;
      try {
        if (wholePending.current && saveWholeRef.current) {
          const stored = await saveWholeRef.current(next);
          // The whole collage replaced whatever was there: nothing older matters.
          synced.current = next;
          waiting.current = waiting.current.filter((event) => stored === undefined || event.revision > stored);
          if (stored !== undefined) {
            included.current = stored;
            applied.current.clear();
            newestOwn.current = stored;
          }
          wholePending.current = false;
        } else {
          const change = diffDocs(base, next);
          if (change) {
            const { revision: stored } = await collageService.applyChanges(
              collageId,
              toServerChanges(change, next),
              session
            );
            // Theirs that landed before ours, then ours, then theirs after.
            needCatchUp = drain((event) => event.revision < stored);
            synced.current = synced.current === base ? next : applyDocChange(synced.current!, change, 'forward');
            markIncluded(stored);
            newestOwn.current = Math.max(newestOwn.current, stored);
          } else {
            synced.current = next;
          }
        }
        needCatchUp = drain() || needCatchUp;
        failures.current = 0;
        savedAny.current = true;
        if (hasUnsent()) schedule(AUTOSAVE_DELAY_MS);
        else setStatus('saved');
        if (needCatchUp) void catchUpRef.current();
        return true;
      } catch (error) {
        logger.warn('Collage autosave failed', { error: (error as Error)?.message });
        if (drain()) void catchUpRef.current();
        const wait = RETRY_DELAYS_MS[Math.min(failures.current, RETRY_DELAYS_MS.length - 1)]!;
        failures.current += 1;
        setStatus('retrying');
        schedule(wait);
        return false;
      }
    })();

    busy.current = attempt;
    try {
      return await attempt;
    } finally {
      busy.current = null;
    }
    // drain works over refs only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [collageId, session, schedule]);

  /**
   * Fetch the collage whole and carry on from it: after the stream was away,
   * or when changes arrived that cannot be put in order.
   */
  const catchUp = useCallback(async (): Promise<void> => {
    while (busy.current) await busy.current;
    const fetch = fetchLatestRef.current;
    if (!fetch || !synced.current) return;

    const run = (async () => {
      try {
        const latestServer = await fetch();
        bringIn(latestServer.doc);
        included.current = latestServer.revision;
        applied.current = new Set([...applied.current].filter((rev) => rev > latestServer.revision));
        drain();
      } catch (error) {
        logger.warn('Could not fetch the collage to catch up', { error: (error as Error)?.message });
      }
    })();
    busy.current = run;
    try {
      await run;
    } finally {
      busy.current = null;
    }
    if (hasUnsent()) schedule(AUTOSAVE_DELAY_MS);
    // bringIn and drain are plain functions over refs; listing them would
    // only rebuild this on every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule]);

  useEffect(() => {
    flushRef.current = flush;
    catchUpRef.current = catchUp;
  }, [flush, catchUp]);

  /** Someone else saved changes. */
  const receive = useCallback((rev: number, changes: ServerChange[]) => {
    const event = { revision: rev, changes };
    if (busy.current) {
      waiting.current.push(event);
      return;
    }
    if (!absorb(event)) void catchUpRef.current();
    // absorb works over refs only.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The server's revision, when the stream (re)opens or someone saved the
   * collage whole. Newer than anything here means something was missed.
   */
  const checkRevision = useCallback((rev: number) => {
    if (rev > newestKnown()) void catchUpRef.current();
  }, []);

  // Another collage starts from its own loaded state.
  useEffect(() => {
    synced.current = null;
    failures.current = 0;
    setStatus('saved');
  }, [collageId]);

  useEffect(() => {
    // A drag just ended: the other screen is showing it where it was let go,
    // waiting for this save. No reason to make them wait the usual pause.
    const justLetGo = pausedRef.current && !paused;
    pausedRef.current = paused;
    if (!doc) return;
    if (synced.current === null) {
      // The first doc is what was loaded: already on the server.
      synced.current = doc;
      latest.current = doc;
      included.current = revision ?? 0;
      if (saveWholeRef.current) {
        wholePending.current = true;
        schedule(0);
      }
      return;
    }
    latest.current = doc;
    if (paused) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      return;
    }
    if (doc !== synced.current && diffDocs(synced.current, doc)) {
      setStatus((current) => (current === 'retrying' ? current : 'saving'));
      schedule(failures.current > 0 ? RETRY_DELAYS_MS[0]! : justLetGo ? 0 : AUTOSAVE_DELAY_MS);
    }
    // `revision` only seeds the first doc.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, paused, schedule]);

  // Leaving the editor sends whatever is still waiting, and has the list pick
  // up what was saved. On unmount only: nothing it reads may re-run it.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void (hasUnsent() ? flushRef.current() : Promise.resolve(true)).finally(() => {
        if (savedAny.current) void queryClientRef.current.invalidateQueries({ queryKey: ['collages'] });
      });
    },
    []
  );

  // Anything not yet confirmed shows as saving or retrying, so the status alone says it.
  return { status, unsaved: status !== 'saved', flush, receive, checkRevision, catchUp };
}
