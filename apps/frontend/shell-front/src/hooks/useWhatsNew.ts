import { useCallback, useState } from 'react';
import { RECENT_NOTES } from '../config/releaseNotes';

const SEEN_KEY = 'tumbaland.whatsNew.seen';

function read(): string[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? 'null');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

function write(ids: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // Private mode: nothing remembers, so nothing nags either (see below).
  }
}

const RECENT_IDS = RECENT_NOTES.map((note) => note.id);

/**
 * Whether there is a note in the release notes this device has not looked at.
 *
 * Tracked by note, not by "newest date seen": a change is written the day its
 * pull request opens and can go out days later, so its date can be older than
 * one already seen. Comparing dates would hide it.
 *
 * A device that has never recorded anything starts with every current note
 * seen. A new person has no use for a list of what changed before they
 * arrived, and an existing one gets their first dot with the next change
 * rather than for notes that were already live. Where storage is unavailable
 * the same rule means no dot at all, which is the quiet way to be wrong.
 *
 * Kept per device: it is a convenience, not an account fact.
 */
export function useWhatsNew(): { unseen: boolean; markSeen: () => void } {
  const [seen, setSeen] = useState<string[]>(() => {
    const stored = read();
    if (stored !== null) return stored;
    write(RECENT_IDS);
    return RECENT_IDS;
  });

  const markSeen = useCallback(() => {
    write(RECENT_IDS);
    setSeen(RECENT_IDS);
  }, []);

  return { unseen: RECENT_IDS.some((id) => !seen.includes(id)), markSeen };
}
