import { useCallback, useEffect, useState } from 'react';

/** How long a typing indicator stays up without another notice. */
export const TYPING_TIMEOUT_MS = 4000;

interface Typist {
  name: string;
  at: number;
}

/** conversationId -> userId -> who is typing there. */
export type TypingMap = Record<string, Record<string, Typist>>;

/** The names typing in one conversation, oldest notice first. */
export const namesTyping = (map: TypingMap, conversationId: string | undefined): string[] =>
  conversationId ? Object.values(map[conversationId] ?? {}).map((typist) => typist.name) : [];

/**
 * Who is typing where, for the thread and the conversation list alike.
 *
 * Notices expire on a timer rather than on a "stopped" event: the sender may
 * close the tab mid-word, and an indicator that never clears is worse than one
 * that clears early. A message from someone clears theirs at once, since
 * sending is the end of typing.
 */
export function useTypingTracker() {
  const [typing, setTyping] = useState<TypingMap>({});

  const note = useCallback((conversationId: string, userId: string, name: string) => {
    setTyping((previous) => ({
      ...previous,
      [conversationId]: { ...previous[conversationId], [userId]: { name, at: Date.now() } }
    }));
  }, []);

  const clear = useCallback((conversationId: string, userId: string) => {
    setTyping((previous) => {
      if (!previous[conversationId]?.[userId]) return previous;
      const { [userId]: _gone, ...rest } = previous[conversationId]!;
      return { ...previous, [conversationId]: rest };
    });
  }, []);

  const anyone = Object.values(typing).some((entries) => Object.keys(entries).length > 0);
  useEffect(() => {
    if (!anyone) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - TYPING_TIMEOUT_MS;
      setTyping((previous) => {
        let changed = false;
        const next: TypingMap = {};
        for (const [conversationId, entries] of Object.entries(previous)) {
          const kept = Object.fromEntries(Object.entries(entries).filter(([, typist]) => typist.at > cutoff));
          if (Object.keys(kept).length !== Object.keys(entries).length) changed = true;
          next[conversationId] = kept;
        }
        return changed ? next : previous;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [anyone]);

  return { typing, note, clear };
}
