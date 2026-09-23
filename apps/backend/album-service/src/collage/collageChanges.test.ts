import { applyChanges, reorderItems, StoredConfig } from './collageChanges';

const config = (): StoredConfig => ({
  version: '2.0',
  backgroundColor: '#fff',
  photos: [
    { id: 'a', x: 0 },
    { id: 'b', x: 10 },
    { id: 'c', x: 20 }
  ],
  texts: [{ id: 't1', text: 'hi' }]
});

describe('applyChanges', () => {
  it('replaces an item in place', () => {
    const next = applyChanges(config(), [{ type: 'put', layer: 'photos', item: { id: 'b', x: 99 } }]);
    expect(next.photos).toEqual([{ id: 'a', x: 0 }, { id: 'b', x: 99 }, { id: 'c', x: 20 }]);
  });

  it('adds a new item where it was asked for, or at the top', () => {
    const placed = applyChanges(config(), [{ type: 'put', layer: 'photos', item: { id: 'd' }, index: 1 }]);
    expect((placed.photos as { id: string }[]).map((p) => p.id)).toEqual(['a', 'd', 'b', 'c']);

    const top = applyChanges(config(), [{ type: 'put', layer: 'texts', item: { id: 't2' } }]);
    expect((top.texts as { id: string }[]).map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('removes an item, and removing it twice is the same as once', () => {
    const change = { type: 'remove' as const, layer: 'photos' as const, id: 'b' };
    const once = applyChanges(config(), [change]);
    expect(applyChanges(once, [change])).toEqual(once);
    expect((once.photos as { id: string }[]).map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('sets only the settings it knows', () => {
    const next = applyChanges(config(), [
      { type: 'settings', values: { backgroundColor: '#000', albumIds: ['nope'] } as Record<string, unknown> }
    ]);
    expect(next.backgroundColor).toBe('#000');
    expect(next).not.toHaveProperty('albumIds');
  });

  it('starts a layer the config did not have yet', () => {
    const next = applyChanges({ version: '2.0' }, [{ type: 'put', layer: 'texts', item: { id: 't1' } }]);
    expect(next.texts).toEqual([{ id: 't1' }]);
  });

  it('does not change the config it was given', () => {
    const original = config();
    applyChanges(original, [{ type: 'remove', layer: 'photos', id: 'a' }]);
    expect(original).toEqual(config());
  });
});

describe('reorderItems', () => {
  const id = (item: string) => item;

  it('puts the named items in the new order', () => {
    expect(reorderItems(['a', 'b', 'c'], ['c', 'a', 'b'], id)).toEqual(['c', 'a', 'b']);
  });

  it('leaves an item it was not told about exactly where it is', () => {
    // "x" was added by the other person after this order was decided.
    expect(reorderItems(['a', 'x', 'b', 'c'], ['b', 'a', 'c'], id)).toEqual(['b', 'x', 'a', 'c']);
  });

  it('ignores ids that are no longer there', () => {
    expect(reorderItems(['a', 'b'], ['gone', 'b', 'a'], id)).toEqual(['b', 'a']);
  });
});
