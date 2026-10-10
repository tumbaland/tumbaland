/**
 * What changed, written for the people who use the app.
 *
 * Not the changelog. CHANGELOG.md is the developer log and is built from
 * commit messages; this is what a partner would want to know, in their words.
 *
 * Each change that someone would notice adds one file to `src/release-notes/`,
 * named `YYYY-MM-DD-short-slug.json`, in the same pull request as the change:
 *
 *   { "date": "2026-10-11", "items": ["Collages can be zoomed"] }
 *
 * A file per change, rather than one list, so that two pull requests open at
 * once never edit the same lines and conflict. Nothing here is edited by hand
 * afterwards. A change nobody would notice adds no file, and the app says
 * nothing about it.
 *
 * Plain copy: short, no dashes, no marketing words.
 */
export interface ReleaseNote {
  /** The file name without `.json`: unique, and what "seen" is tracked by. */
  id: string;
  /** YYYY-MM-DD, the day the change went out. Grouped by, and shown. */
  date: string;
  items: string[];
}

/** How many of the newest notes the app lists and tracks. Older ones stay in git. */
export const RECENT_NOTES_LIMIT = 20;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isFragment(value: unknown): value is { date: string; items: string[] } {
  if (typeof value !== 'object' || value === null) return false;
  const { date, items } = value as { date?: unknown; items?: unknown };
  return (
    typeof date === 'string' &&
    DATE.test(date) &&
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => typeof item === 'string' && item.trim() !== '')
  );
}

/**
 * Turns the fragment files into notes, newest first.
 *
 * A malformed file is left out rather than allowed to take the app down: this
 * runs on every page load, for a nicety. The tests read the folder strictly,
 * so a bad file fails in CI instead of quietly going missing here.
 */
export function parseNotes(fragments: Record<string, unknown>): ReleaseNote[] {
  const notes: ReleaseNote[] = [];
  for (const [path, value] of Object.entries(fragments)) {
    if (!isFragment(value)) continue;
    const id = path.slice(path.lastIndexOf('/') + 1).replace(/\.json$/, '');
    notes.push({ id, date: value.date, items: value.items });
  }
  return notes.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export interface NotesDay {
  date: string;
  items: string[];
}

/** Notes under the day they went out: several changes on one day read as one list. */
export function groupByDate(notes: ReleaseNote[]): NotesDay[] {
  const days: NotesDay[] = [];
  for (const note of notes) {
    const last = days[days.length - 1];
    if (last && last.date === note.date) last.items.push(...note.items);
    else days.push({ date: note.date, items: [...note.items] });
  }
  return days;
}

const fragments = import.meta.glob<unknown>('../release-notes/*.json', { eager: true, import: 'default' });

export const RELEASE_NOTES: ReleaseNote[] = parseNotes(fragments);

/** The notes the app lists, and the ones the unseen dot is about. */
export const RECENT_NOTES: ReleaseNote[] = RELEASE_NOTES.slice(0, RECENT_NOTES_LIMIT);

/** The release this build was cut from, or "dev" for a build outside one. */
export const APP_VERSION: string = __APP_VERSION__;
