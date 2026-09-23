/**
 * Small changes to a stored collage, applied one batch at a time.
 *
 * The editor used to send the whole config on Save, and the server replaced
 * whatever it had. With two people editing, the second save silently wiped the
 * first person's work. Changes name the item they touch, so two edits to
 * different photos both land, and two edits to the same photo end with the
 * later one — for that photo only.
 *
 * Items are stored as the client serialized them. This file only needs their
 * `id`; what a photo or text box contains is the editor's business, and keeping
 * it opaque here means a new field in the editor needs no server change.
 */

export type CollageLayer = 'photos' | 'texts';

export type StoredItem = { id: string } & Record<string, unknown>;

/** Top-level config keys a change may set. Anything else stays as it is. */
export const COLLAGE_SETTINGS = ['viewport', 'backgroundColor', 'borderColor', 'photoTransparencyMode', 'title'] as const;
export type CollageSetting = (typeof COLLAGE_SETTINGS)[number];

export type CollageChange =
  /** Add or replace an item. `index` places a new one; an existing one keeps its place. */
  | { type: 'put'; layer: CollageLayer; item: StoredItem; index?: number }
  | { type: 'remove'; layer: CollageLayer; id: string }
  /** Stacking order. Only the named items move, among the places they already hold. */
  | { type: 'order'; layer: CollageLayer; ids: string[] }
  | { type: 'settings'; values: Partial<Record<CollageSetting, unknown>> };

export type StoredConfig = Record<string, unknown> & {
  photos?: unknown[];
  texts?: unknown[];
};

const hasId = (value: unknown): value is StoredItem =>
  typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';

/**
 * Put the named items in the given order, each taking one of the slots the
 * named items held between them. Items not named stay exactly where they are,
 * so reordering never disturbs something the other person just added.
 */
export function reorderItems<T>(items: T[], ids: string[], idOf: (item: T) => string | undefined): T[] {
  const rank = new Map(ids.map((id, index) => [id, index]));
  const slots: number[] = [];
  const moving: T[] = [];
  items.forEach((item, index) => {
    const id = idOf(item);
    if (id !== undefined && rank.has(id)) {
      slots.push(index);
      moving.push(item);
    }
  });
  moving.sort((a, b) => rank.get(idOf(a)!)! - rank.get(idOf(b)!)!);

  const next = items.slice();
  slots.forEach((slot, index) => {
    next[slot] = moving[index]!;
  });
  return next;
}

function applyOne(config: StoredConfig, change: CollageChange): StoredConfig {
  if (change.type === 'settings') {
    const values = Object.fromEntries(
      Object.entries(change.values).filter(([key]) => (COLLAGE_SETTINGS as readonly string[]).includes(key))
    );
    return { ...config, ...values };
  }

  const items = Array.isArray(config[change.layer]) ? (config[change.layer] as unknown[]) : [];
  const idOf = (item: unknown) => (hasId(item) ? item.id : undefined);

  switch (change.type) {
    case 'put': {
      const at = items.findIndex((item) => idOf(item) === change.item.id);
      const next = items.slice();
      if (at !== -1) next[at] = change.item;
      else next.splice(Math.min(Math.max(change.index ?? next.length, 0), next.length), 0, change.item);
      return { ...config, [change.layer]: next };
    }
    case 'remove':
      return { ...config, [change.layer]: items.filter((item) => idOf(item) !== change.id) };
    case 'order':
      return { ...config, [change.layer]: reorderItems(items, change.ids, idOf) };
  }
}

/** Apply a batch in order. Every change is safe to repeat, so a retried batch lands the same. */
export function applyChanges(config: StoredConfig, changes: CollageChange[]): StoredConfig {
  return changes.reduce(applyOne, { ...config });
}
