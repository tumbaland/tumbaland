import { useCallback, useEffect, useState } from 'react';

/** How long a typing indicator stays up without another notice. */
export const TYPING_TIMEOUT_MS = 4000;

interface Typist {
  name: string;
  at: number;
  /** An assistant at work, not a person typing. */
  bot?: boolean;
  /** What the assistant is doing, as a short phrase: "making a collage". */
  activity?: string;
}

/** conversationId -> userId -> who is typing there. */
export type TypingMap = Record<string, Record<string, Typist>>;

/**
 * The people typing in one conversation, oldest notice first. Assistants are
 * not in it: the header and the list say "typing" about a person, and an
 * assistant working is shown on its own line (see `assistantsWorking`).
 */
export const namesTyping = (map: TypingMap, conversationId: string | undefined): string[] =>
  conversationId
    ? Object.values(map[conversationId] ?? {})
        .filter((typist) => !typist.bot)
        .map((typist) => typist.name)
    : [];

export interface AssistantAtWork {
  name: string;
  activity?: string;
}

/** The assistants working in one conversation, and on what. */
export const assistantsWorking = (map: TypingMap, conversationId: string | undefined): AssistantAtWork[] =>
  conversationId
    ? Object.values(map[conversationId] ?? {})
        .filter((typist) => typist.bot)
        .map((typist) => ({ name: typist.name, activity: typist.activity }))
    : [];

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

  const note = useCallback(
    (conversationId: string, userId: string, name: string, extra?: { bot?: boolean; activity?: string }) => {
      setTyping((previous) => ({
        ...previous,
        [conversationId]: { ...previous[conversationId], [userId]: { name, at: Date.now(), ...extra } }
      }));
    },
    []
  );

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
