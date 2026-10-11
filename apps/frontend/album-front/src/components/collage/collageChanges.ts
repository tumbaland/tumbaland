import {
  CollageDoc,
  CollagePhotoItem,
  CollageTextItem,
  normalizePhoto,
  normalizeText,
  serializePhoto,
  serializeSettings,
  serializeText
} from '@tumbaland/collage-core';
import type { CollageConfigPhoto, CollageTextBox } from '../../types/collage';

/**
 * What one edit did to a collage, both ways round.
 *
 * Undo used to keep whole copies of the collage and step back to the previous
 * one. With two people editing, that copy predates the other person's work, so
 * undoing your own move would also throw theirs away. A change names only the
 * items it touched, and undoing it puts back only those.
 *
 * The same diff drives autosave: what changed since the last save is what gets
 * sent, as small changes the server can apply on top of anyone else's.
 */

export type Layer = 'photos' | 'texts';

export interface ItemChange<T> {
  id: string;
  /** null: the item did not exist before (added) or does not after (removed). */
  before: T | null;
  after: T | null;
  /** Where it sat in its layer, so undoing a delete puts it back at the same depth. */
  beforeIndex: number;
  afterIndex: number;
}

export interface OrderChange {
  before: string[];
  after: string[];
}

export type DocSettings = Pick<CollageDoc, 'canvas' | 'background' | 'frameEnabled' | 'frameColor'>;
const SETTING_KEYS: (keyof DocSettings)[] = ['canvas', 'background', 'frameEnabled', 'frameColor'];

export interface DocChange {
  photos: ItemChange<CollagePhotoItem>[];
  texts: ItemChange<CollageTextItem>[];
  photoOrder?: OrderChange;
  textOrder?: OrderChange;
  settings?: { before: Partial<DocSettings>; after: Partial<DocSettings> };
}

/** What the server's `POST /collages/:id/changes` takes. */
export type ServerChange =
  | { type: 'put'; layer: Layer; item: { id: string } & Record<string, unknown>; index?: number }
  | { type: 'remove'; layer: Layer; id: string }
  | { type: 'order'; layer: Layer; ids: string[] }
  | { type: 'settings'; values: Record<string, unknown> };

/**
 * Serialised with keys in a fixed order. An item read back from the server
 * lists its fields in a different order from one made in this editor, and the
 * two must still compare equal, or every incoming change would look like a
 * local edit waiting to be sent.
 */
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : inner
  );

const same = (a: unknown, b: unknown): boolean => a === b || canonical(a) === canonical(b);

function diffItems<T extends { id: string }>(before: T[], after: T[]): ItemChange<T>[] {
  const changes: ItemChange<T>[] = [];
  const afterIndex = new Map(after.map((item, index) => [item.id, index]));
  const beforeIndex = new Map(before.map((item, index) => [item.id, index]));

  before.forEach((item, index) => {
    const at = afterIndex.get(item.id);
    const next = at === undefined ? null : after[at]!;
    if (next !== null && same(item, next)) return;
    changes.push({ id: item.id, before: item, after: next, beforeIndex: index, afterIndex: at ?? index });
  });
  after.forEach((item, index) => {
    if (beforeIndex.has(item.id)) return;
    changes.push({ id: item.id, before: null, after: item, beforeIndex: index, afterIndex: index });
  });
  return changes;
}

/** The stacking order, when the items both sides share are in a different order. */
function diffOrder(before: { id: string }[], after: { id: string }[]): OrderChange | undefined {
  const shared = new Set(after.map((item) => item.id));
  const was = before.map((item) => item.id).filter((id) => shared.has(id));
  const kept = new Set(was);
  const now = after.map((item) => item.id).filter((id) => kept.has(id));
  return same(was, now) ? undefined : { before: was, after: now };
}

/** What changed from `before` to `after`, or null when nothing did. */
export function diffDocs(before: CollageDoc, after: CollageDoc): DocChange | null {
  if (before === after) return null;

  const change: DocChange = {
    photos: before.photos === after.photos ? [] : diffItems(before.photos, after.photos),
    texts: before.texts === after.texts ? [] : diffItems(before.texts, after.texts),
    photoOrder: before.photos === after.photos ? undefined : diffOrder(before.photos, after.photos),
    textOrder: before.texts === after.texts ? undefined : diffOrder(before.texts, after.texts)
  };

  const was: Partial<DocSettings> = {};
  const now: Partial<DocSettings> = {};
  for (const key of SETTING_KEYS) {
    if (!same(before[key], after[key])) {
      (was as Record<string, unknown>)[key] = before[key];
      (now as Record<string, unknown>)[key] = after[key];
    }
  }
  if (Object.keys(now).length > 0) change.settings = { before: was, after: now };

  const empty =
    change.photos.length === 0 &&
    change.texts.length === 0 &&
    !change.photoOrder &&
    !change.textOrder &&
    !change.settings;
  return empty ? null : change;
}

/**
 * Put the named items in the given order among the places they already hold.
 * Anything not named stays where it is: the server does the same, so an item
 * the other person added keeps its depth.
 */
export function reorderItems<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const rank = new Map(ids.map((id, index) => [id, index]));
  const slots: number[] = [];
  const moving: T[] = [];
  items.forEach((item, index) => {
    if (rank.has(item.id)) {
      slots.push(index);
      moving.push(item);
    }
  });
  moving.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const next = items.slice();
  slots.forEach((slot, index) => {
    next[slot] = moving[index]!;
  });
  return next;
}

function applyItems<T extends { id: string }>(items: T[], changes: ItemChange<T>[], forward: boolean): T[] {
  let next = items;
  for (const change of changes) {
    const target = forward ? change.after : change.before;
    const index = forward ? change.afterIndex : change.beforeIndex;
    const at = next.findIndex((item) => item.id === change.id);
    // A change to an item someone else has since deleted: nothing to change.
    // Undoing your move of it must not bring back a photo they removed.
    const wasEdit = change.before !== null && change.after !== null;
    if (at === -1 && wasEdit) continue;
    if (target === null) {
      if (at !== -1) next = next.filter((item) => item.id !== change.id);
    } else if (at !== -1) {
      next = next.slice();
      next[at] = target;
    } else {
      next = next.slice();
      next.splice(Math.min(index, next.length), 0, target);
    }
  }
  return next;
}

/** Apply a change forwards (redo) or backwards (undo) to whatever the collage is now. */
export function applyDocChange(doc: CollageDoc, change: DocChange, direction: 'forward' | 'back'): CollageDoc {
  const forward = direction === 'forward';
  // Items first, then order: an undone delete has to be back before it can be ordered.
  let photos = change.photos.length > 0 ? applyItems(doc.photos, change.photos, forward) : doc.photos;
  let texts = change.texts.length > 0 ? applyItems(doc.texts, change.texts, forward) : doc.texts;
  if (change.photoOrder) photos = reorderItems(photos, forward ? change.photoOrder.after : change.photoOrder.before);
  if (change.textOrder) texts = reorderItems(texts, forward ? change.textOrder.after : change.textOrder.before);

  const settings = change.settings ? (forward ? change.settings.after : change.settings.before) : {};
  return { ...doc, ...settings, photos, texts };
}

/**
 * The server changes that take a collage from `before` to `after`.
 *
 * Changed items are sent whole rather than field by field: a photo is a dozen
 * numbers, and a whole item is safe to apply twice, which is what makes a
 * retried save harmless.
 */
export function toServerChanges(change: DocChange, after: CollageDoc): ServerChange[] {
  const out: ServerChange[] = [];

  for (const item of change.photos) {
    out.push(
      item.after
        ? {
            type: 'put',
            layer: 'photos',
            item: serializePhoto(item.after, after.frameEnabled) as unknown as { id: string },
            index: item.afterIndex
          }
        : { type: 'remove', layer: 'photos', id: item.id }
    );
  }
  for (const item of change.texts) {
    out.push(
      item.after
        ? {
            type: 'put',
            layer: 'texts',
            item: serializeText(item.after) as unknown as { id: string },
            index: item.afterIndex
          }
        : { type: 'remove', layer: 'texts', id: item.id }
    );
  }
  if (change.photoOrder) out.push({ type: 'order', layer: 'photos', ids: change.photoOrder.after });
  if (change.textOrder) out.push({ type: 'order', layer: 'texts', ids: change.textOrder.after });

  if (change.settings) {
    const all = serializeSettings(after);
    const values: Record<string, unknown> = {};
    const { canvas, background, frameColor, frameEnabled } = change.settings.after;
    if (canvas !== undefined) values.viewport = all.viewport;
    if (background !== undefined) values.backgroundColor = all.backgroundColor;
    if (frameColor !== undefined) values.borderColor = all.borderColor;
    if (frameEnabled !== undefined) values.photoTransparencyMode = all.photoTransparencyMode;
    out.push({ type: 'settings', values });
  }

  return out;
}

function putItem<T extends { id: string }>(items: T[], item: T, index?: number): T[] {
  const at = items.findIndex((existing) => existing.id === item.id);
  const next = items.slice();
  if (at !== -1) next[at] = item;
  else next.splice(Math.min(Math.max(index ?? next.length, 0), next.length), 0, item);
  return next;
}

/**
 * Apply changes someone else saved, in the same way the server applied them,
 * so both ends arrive at the same collage.
 */
export function applyServerChanges(doc: CollageDoc, changes: ServerChange[]): CollageDoc {
  let next = doc;
  for (const change of changes) {
    switch (change.type) {
      case 'put':
        next =
          change.layer === 'photos'
            ? { ...next, photos: putItem(next.photos, normalizePhoto(change.item as unknown as CollageConfigPhoto), change.index) }
            : { ...next, texts: putItem(next.texts, normalizeText(change.item as unknown as CollageTextBox), change.index) };
        break;
      case 'remove':
        next =
          change.layer === 'photos'
            ? { ...next, photos: next.photos.filter((item) => item.id !== change.id) }
            : { ...next, texts: next.texts.filter((item) => item.id !== change.id) };
        break;
      case 'order':
        next =
          change.layer === 'photos'
            ? { ...next, photos: reorderItems(next.photos, change.ids) }
            : { ...next, texts: reorderItems(next.texts, change.ids) };
        break;
      case 'settings': {
        const values = change.values as {
          viewport?: { width: number; height: number };
          backgroundColor?: string;
          borderColor?: string;
          photoTransparencyMode?: boolean;
        };
        next = {
          ...next,
          ...(values.viewport ? { canvas: { width: values.viewport.width, height: values.viewport.height } } : {}),
          ...(values.backgroundColor !== undefined ? { background: values.backgroundColor } : {}),
          ...(values.borderColor !== undefined ? { frameColor: values.borderColor } : {}),
          ...(values.photoTransparencyMode !== undefined ? { frameEnabled: !values.photoTransparencyMode } : {})
        };
        break;
      }
    }
  }
  return next;
}

/**
 * Move local work onto a newer copy of the collage.
 *
 * `local` was built on `base`; `incoming` is `base` with someone else's changes
 * applied. What this editor changed since `base` is replayed on top, so an
 * unsaved move of yours survives their save, and everything you did not touch
 * takes their version. With nothing local the result is `incoming` itself.
 */
export function rebase(local: CollageDoc, base: CollageDoc, incoming: CollageDoc): CollageDoc {
  const own = diffDocs(base, local);
  return own ? applyDocChange(incoming, own, 'forward') : incoming;
}
