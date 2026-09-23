import { useSyncExternalStore } from 'react';
import { QUICK_REACTIONS } from './EmojiPicker';

/**
 * The emoji this person uses, most recent first, for the row above the
 * message box.
 *
 * Kept on the device rather than on the account: it is a convenience, and a
 * round trip to save one tap's history is not worth making. Fed by the full
 * picker, by reactions, and by the emoji in messages as they are sent, so it
 * learns from typing on a phone's own emoji keyboard too.
 */
const STORAGE_KEY = 'tumbaland-chat-recent-emoji';
const LIMIT = 16;
const CHANGED = 'tumbaland-recent-emoji-changed';

/** Before anything has been used: the quick reactions, which are the common ones. */
const STARTER: readonly string[] = QUICK_REACTIONS;

let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    cache = Array.isArray(stored) && stored.every((item) => typeof item === 'string') ? stored : [...STARTER];
  } catch {
    cache = [...STARTER];
  }
  return cache;
}

/** Moves each emoji to the front, in the order given, keeping the list short. */
export function recordEmoji(...emoji: string[]): void {
  if (emoji.length === 0) return;
  let next = read();
  for (const item of emoji) next = [item, ...next.filter((existing) => existing !== item)];
  cache = next.slice(0, LIMIT);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Private mode: the row still updates for this visit.
  }
  window.dispatchEvent(new Event(CHANGED));
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter() : null;

/**
 * The emoji in a piece of text, as whole emoji: a skin tone, a flag or a
 * family is one grapheme, and counting its parts would fill the row with
 * halves of it.
 */
export function emojiIn(text: string): string[] {
  const graphemes = segmenter ? [...segmenter.segment(text)].map((part) => part.segment) : Array.from(text);
  return graphemes.filter((grapheme) => /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(grapheme));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    // Another tab used one.
    cache = null;
    onChange();
  };
  window.addEventListener(CHANGED, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

export function useRecentEmoji(): string[] {
  return useSyncExternalStore(subscribe, read, () => [...STARTER]);
}

/** For tests: forget what was read, so the next read goes back to storage. */
export function resetRecentEmojiCache(): void {
  cache = null;
}
