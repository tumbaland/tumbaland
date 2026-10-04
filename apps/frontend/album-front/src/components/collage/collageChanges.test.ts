import { describe, expect, it } from 'vite-plus/test';
import { applyDocChange, diffDocs, reorderItems, toServerChanges } from './collageChanges';
import { CollageDoc, CollagePhotoItem } from './collageDoc';

const photo = (id: string, x = 0): CollagePhotoItem => ({
  id,
  photoId: `p-${id}`,
  x,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  caption: ''
});

const doc = (overrides: Partial<CollageDoc> = {}): CollageDoc => ({
  canvas: { width: 1600, height: 900 },
  background: '#fff',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [photo('a'), photo('b'), photo('c')],
  texts: [],
  ...overrides
});

describe('diffDocs', () => {
  it('finds nothing between a collage and itself, or an identical copy', () => {
    const base = doc();
    expect(diffDocs(base, base)).toBeNull();
    expect(diffDocs(base, doc())).toBeNull();
  });

  it('names only the photo that moved', () => {
    const before = doc();
    const after = { ...before, photos: [before.photos[0], photo('b', 50), before.photos[2]] };

    const change = diffDocs(before, after)!;

    expect(change.photos).toHaveLength(1);
    expect(change.photos[0]).toMatchObject({ id: 'b', before: { x: 0 }, after: { x: 50 } });
    expect(change.photoOrder).toBeUndefined();
  });

  it('records where an added or removed photo sits', () => {
    const before = doc();
    const removed = diffDocs(before, { ...before, photos: [before.photos[0], before.photos[2]] })!;
    expect(removed.photos[0]).toMatchObject({ id: 'b', after: null, beforeIndex: 1 });

    const added = diffDocs(before, { ...before, photos: [...before.photos, photo('d')] })!;
    expect(added.photos[0]).toMatchObject({ id: 'd', before: null, afterIndex: 3 });
  });

  it('sees a change of stacking order', () => {
    const before = doc();
    const [a, b, c] = before.photos;
    const change = diffDocs(before, { ...before, photos: [b, a, c] })!;
    expect(change.photoOrder).toEqual({ before: ['a', 'b', 'c'], after: ['b', 'a', 'c'] });
  });

  it('sees a setting change', () => {
    const change = diffDocs(doc(), doc({ background: '#000' }))!;
    expect(change.settings).toEqual({ before: { background: '#fff' }, after: { background: '#000' } });
  });
});

describe('applyDocChange', () => {
  it('undoes and redoes a move', () => {
    const before = doc();
    const after = { ...before, photos: [before.photos[0], photo('b', 50), before.photos[2]] };
    const change = diffDocs(before, after)!;

    expect(applyDocChange(after, change, 'back').photos[1].x).toBe(0);
    expect(applyDocChange(before, change, 'forward').photos[1].x).toBe(50);
  });

  it('undoing a move leaves another photo that has changed since alone', () => {
    const before = doc();
    const moved = { ...before, photos: [before.photos[0], photo('b', 50), before.photos[2]] };
    const change = diffDocs(before, moved)!;
    // Someone then moved "a".
    const later = { ...moved, photos: [photo('a', 99), moved.photos[1], moved.photos[2]] };

    const undone = applyDocChange(later, change, 'back');

    expect(undone.photos.map((p) => p.x)).toEqual([99, 0, 0]);
  });

  it('puts a deleted photo back at its depth, and deletes it again on redo', () => {
    const before = doc();
    const after = { ...before, photos: [before.photos[0], before.photos[2]] };
    const change = diffDocs(before, after)!;

    const restored = applyDocChange(after, change, 'back');
    expect(restored.photos.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(applyDocChange(restored, change, 'forward').photos.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('undoes a reorder and a setting', () => {
    const before = doc();
    const [a, b, c] = before.photos;
    const after = { ...before, background: '#000', photos: [c, a, b] };
    const change = diffDocs(before, after)!;

    const undone = applyDocChange(after, change, 'back');

    expect(undone.photos.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(undone.background).toBe('#fff');
  });
});

describe('reorderItems', () => {
  it('moves only the named items among their own places', () => {
    const items = ['a', 'x', 'b'].map((id) => ({ id }));
    expect(reorderItems(items, ['b', 'a']).map((i) => i.id)).toEqual(['b', 'x', 'a']);
  });
});

describe('toServerChanges', () => {
  it('sends a moved photo whole, as it is stored', () => {
    const before = doc();
    const after = { ...before, photos: [before.photos[0], photo('b', 50), before.photos[2]] };

    const [change] = toServerChanges(diffDocs(before, after)!, after);

    expect(change).toMatchObject({
      type: 'put',
      layer: 'photos',
      index: 1,
      item: { id: 'b', photoId: 'p-b', x: 50, position: { left: 50, top: 0 } }
    });
  });

  it('sends a removal, an order and settings under their stored names', () => {
    const before = doc();
    const [a, , c] = before.photos;
    const after = { ...before, frameEnabled: true, frameColor: '#f00', photos: [c, a] };

    const changes = toServerChanges(diffDocs(before, after)!, after);

    expect(changes).toEqual([
      { type: 'remove', layer: 'photos', id: 'b' },
      { type: 'order', layer: 'photos', ids: ['c', 'a'] },
      { type: 'settings', values: { borderColor: '#f00', photoTransparencyMode: false } }
    ]);
  });
});
