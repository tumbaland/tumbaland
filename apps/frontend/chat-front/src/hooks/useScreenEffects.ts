import { useCallback, useEffect, useRef, useState } from 'react';
import { effectOf } from '../components/thread/effects';
import type { MessageEffect, ThreadMessage } from '../types';

export interface PlayingEffect {
  /** The message it is for. A new message remounts the layer, restarting it. */
  key: string;
  effect: MessageEffect;
}

const PLAYED_KEY = 'tumbaland-chat-played-effects';
const PLAYED_LIMIT = 50;
/** How long an effect waits for the other person to open the thread. */
const CATCH_UP_MS = 24 * 60 * 60 * 1000;

function readPlayed(): string[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAYED_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberPlayed(clientId: string): void {
  try {
    const played = [clientId, ...readPlayed().filter((id) => id !== clientId)].slice(0, PLAYED_LIMIT);
    window.localStorage.setItem(PLAYED_KEY, JSON.stringify(played));
  } catch {
    // Private mode or full storage: at worst an effect plays twice.
  }
}

const time = (message: ThreadMessage) => new Date(message.createdAt).getTime();

/**
 * Which screen effect to play, if any.
 *
 * Plays for a message that arrives while the thread is open, sent or received.
 * Nothing already in the thread when it loads plays, and neither does anything
 * in an older page scrolled back to, with one exception: the newest message,
 * when it came from someone else and has not been played on this device. The
 * person the hearts were sent to is usually not looking at the thread when
 * they land, and opening it from the notification is when they should see them.
 */
export function useScreenEffects(
  conversationId: string | undefined,
  messages: ThreadMessage[],
  currentUserId: string,
  ready: boolean
): { playing: PlayingEffect | null; done: () => void } {
  const [playing, setPlaying] = useState<PlayingEffect | null>(null);
  const seen = useRef<Set<string> | null>(null);
  /** The newest message there was on load. Anything later is new. */
  const baseline = useRef(0);

  // Another conversation starts from scratch.
  useEffect(() => {
    seen.current = null;
    setPlaying(null);
  }, [conversationId]);

  useEffect(() => {
    // Right after a switch the list still holds the last conversation's
    // messages for a render, and taking those as the baseline would play the
    // new one's history as if it had just arrived.
    const current = messages.every((message) => message.conversationId === conversationId);
    if (!ready || !currentUserId || !current) return;

    const play = (message: ThreadMessage, effect: MessageEffect) => {
      rememberPlayed(message.clientId);
      setPlaying({ key: message.clientId, effect });
    };

    if (seen.current === null) {
      seen.current = new Set(messages.map((message) => message.clientId));
      baseline.current = messages.reduce((newest, message) => Math.max(newest, time(message)), 0);

      const newest = [...messages].reverse().find((message) => message.kind !== 'system');
      const effect = newest ? effectOf(newest) : null;
      if (
        newest &&
        effect &&
        newest.senderId !== currentUserId &&
        Date.now() - time(newest) < CATCH_UP_MS &&
        !readPlayed().includes(newest.clientId)
      ) {
        play(newest, effect);
      }
      return;
    }

    let latest: { message: ThreadMessage; effect: MessageEffect } | null = null;
    for (const message of messages) {
      if (seen.current.has(message.clientId)) continue;
      seen.current.add(message.clientId);
      // One just sent here is new whatever the clock says; the rest are new
      // when they are later than the thread was on load, which leaves out
      // older pages.
      const arrived = message.delivery === 'pending' || time(message) > baseline.current;
      const effect = arrived ? effectOf(message) : null;
      if (effect) latest = { message, effect };
    }
    if (latest) play(latest.message, latest.effect);
  }, [conversationId, messages, currentUserId, ready]);

  const done = useCallback(() => setPlaying(null), []);
  return { playing, done };
}
