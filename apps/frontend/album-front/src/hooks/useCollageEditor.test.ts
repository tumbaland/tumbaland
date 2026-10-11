import { act, renderHook } from '@testing-library/react';
import { useCollageEditor } from './useCollageEditor';
import { CollageDoc } from '@tumbaland/collage-core';

const emptyDoc: CollageDoc = {
  canvas: { width: 1600, height: 900 },
  background: '#111111',
  frameEnabled: true,
  frameColor: '#ffffff',
  photos: [],
  texts: []
};

it('starts with no doc and a clean, non-undoable state', () => {
  const { result } = renderHook(() => useCollageEditor());

  expect(result.current.doc).toBeNull();
  expect(result.current.canUndo).toBe(false);
  expect(result.current.canRedo).toBe(false);
  expect(result.current.selectedItem).toBeNull();
});

it('init loads a doc with no history', () => {
  const { result } = renderHook(() => useCollageEditor());

  act(() => result.current.init(emptyDoc));

  expect(result.current.doc).toBe(emptyDoc);
  expect(result.current.canUndo).toBe(false);
});

describe('addPhoto / addText / removeItem', () => {
  it('addPhoto appends a photo item, selects it, and makes it undoable', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    let newId = '';
    act(() => {
      newId = result.current.addPhoto({
        photoId: 'photo-1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        caption: ''
      });
    });

    expect(result.current.doc?.photos).toHaveLength(1);
    expect(result.current.doc?.photos[0]).toMatchObject({ id: newId, photoId: 'photo-1' });
    expect(result.current.selectedId).toBe(newId);
    expect(result.current.selectedItem).toMatchObject({ kind: 'photo', item: { id: newId } });
    expect(result.current.canUndo).toBe(true);
  });

  it('addText appends a text item with default styling merged with overrides', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    let newId = '';
    act(() => {
      newId = result.current.addText({ text: 'Hello' });
    });

    expect(result.current.doc?.texts[0]).toMatchObject({ id: newId, text: 'Hello', fontSize: 32, color: '#e91e63' });
    expect(result.current.selectedItem).toMatchObject({ kind: 'text', item: { id: newId, text: 'Hello' } });
  });

  it('removeItem deletes a matching photo and leaves other items alone', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    let photoId = '';
    act(() => {
      photoId = result.current.addPhoto({
        photoId: 'photo-1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        caption: ''
      });
      result.current.addText({ text: 'keep me' });
    });

    act(() => result.current.removeItem(photoId));

    expect(result.current.doc?.photos).toHaveLength(0);
    expect(result.current.doc?.texts).toHaveLength(1);
    expect(result.current.selectedId).toBeNull();
  });

  it('removeItem deletes a matching text item and leaves other items alone', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    let textId = '';
    act(() => {
      result.current.addPhoto({ photoId: 'photo-1', x: 0, y: 0, width: 100, height: 100, rotation: 0, caption: '' });
      textId = result.current.addText({ text: 'delete me' });
    });

    act(() => result.current.removeItem(textId));

    expect(result.current.doc?.texts).toHaveLength(0);
    expect(result.current.doc?.photos).toHaveLength(1);
  });
});

describe('patchItem / patchDoc', () => {
  it('patchItem updates a matching photo in place', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    let photoId = '';
    act(() => {
      photoId = result.current.addPhoto({
        photoId: 'photo-1',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        caption: ''
      });
    });

    act(() => result.current.patchItem(photoId, { x: 50, caption: 'updated' }));

    expect(result.current.doc?.photos[0]).toMatchObject({ x: 50, caption: 'updated' });
  });

  it('patchItem is a no-op for an id that does not exist', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.patchItem('missing-id', { x: 50 }));

    expect(result.current.doc?.photos).toHaveLength(0);
  });

  it('patchDoc merges top-level doc fields', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.patchDoc({ background: '#ffffff', frameEnabled: false }));

    expect(result.current.doc).toMatchObject({ background: '#ffffff', frameEnabled: false });
  });
});

describe('reorderItem', () => {
  it('brings a photo forward within the photos layer', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    act(() => {
      result.current.addPhoto({ photoId: 'p1', x: 0, y: 0, width: 10, height: 10, rotation: 0, caption: '' });
      result.current.addPhoto({ photoId: 'p2', x: 0, y: 0, width: 10, height: 10, rotation: 0, caption: '' });
    });
    const [firstId] = result.current.doc!.photos.map((p) => p.id);

    act(() => result.current.reorderItem(firstId, 1));

    expect(result.current.doc?.photos.map((p) => p.photoId)).toEqual(['p2', 'p1']);
  });

  it('reorders a text item within the texts layer, independent of photos', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    act(() => {
      result.current.addText({ text: 'first' });
      result.current.addText({ text: 'second' });
    });
    const [firstId] = result.current.doc!.texts.map((t) => t.id);

    act(() => result.current.reorderItem(firstId, 1));

    expect(result.current.doc?.texts.map((t) => t.text)).toEqual(['second', 'first']);
  });

  it('is a no-op (no history push) for an id present in neither layer', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.reorderItem('missing-id', 1));

    expect(result.current.canUndo).toBe(false);
  });
});

describe('undo / redo', () => {
  it('undo restores the previous doc and enables redo; redo restores it forward again', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    act(() => result.current.patchDoc({ background: '#222222' }));

    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());

    expect(result.current.doc?.background).toBe('#111111');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());

    expect(result.current.doc?.background).toBe('#222222');
    expect(result.current.canRedo).toBe(false);
  });

  it('undo is a no-op with no history', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.undo());

    expect(result.current.doc).toBe(emptyDoc);
  });

  it('redo is a no-op with nothing to redo', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.redo());

    expect(result.current.doc).toBe(emptyDoc);
  });

  it('a new commit after undo clears the redo stack', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    act(() => result.current.patchDoc({ background: '#222222' }));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.patchDoc({ background: '#333333' }));

    expect(result.current.canRedo).toBe(false);
  });
});

describe('gestures', () => {
  it('collapses a begin/move/move/end sequence into a single undo step', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    let photoId = '';
    act(() => {
      photoId = result.current.addPhoto({ photoId: 'p1', x: 0, y: 0, width: 10, height: 10, rotation: 0, caption: '' });
    });
    const stepsBeforeGesture = result.current.canUndo;

    act(() => {
      result.current.beginGesture();
      result.current.gesturePatchItem(photoId, { x: 10 });
      result.current.gesturePatchItem(photoId, { x: 20 });
      result.current.endGesture();
    });

    expect(result.current.doc?.photos[0].x).toBe(20);
    expect(stepsBeforeGesture).toBe(true);
    // One undo unwinds the *entire* gesture back to its pre-gesture position,
    // not just the last of the two gesturePatchItem moves.
    act(() => result.current.undo());
    expect(result.current.doc?.photos[0].x).toBe(0);
  });

  it('endGesture without a prior beginGesture is a no-op', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.endGesture());

    expect(result.current.canUndo).toBe(false);
  });

  it('a gesture that ends with no net change pushes no history', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => {
      result.current.beginGesture();
      result.current.endGesture();
    });

    expect(result.current.canUndo).toBe(false);
  });

  it('gesturePatchItem before beginGesture is a no-op', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    let photoId = '';
    act(() => {
      photoId = result.current.addPhoto({ photoId: 'p1', x: 0, y: 0, width: 10, height: 10, rotation: 0, caption: '' });
    });

    act(() => result.current.gesturePatchItem(photoId, { x: 999 }));

    expect(result.current.doc?.photos[0].x).toBe(0);
  });
});

describe('undo only reverses what it recorded', () => {
  const photo = (photoId: string) => ({ photoId, x: 0, y: 0, width: 10, height: 10, rotation: 0, caption: '' });

  it('puts a deleted photo back at the same depth', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    const ids: string[] = [];
    act(() => {
      ids.push(result.current.addPhoto(photo('a')));
      ids.push(result.current.addPhoto(photo('b')));
      ids.push(result.current.addPhoto(photo('c')));
    });

    act(() => result.current.removeItem(ids[1]));
    act(() => result.current.undo());

    expect(result.current.doc?.photos.map((p) => p.photoId)).toEqual(['a', 'b', 'c']);
  });

  it('leaves a later change to another photo alone', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    const ids: string[] = [];
    act(() => {
      ids.push(result.current.addPhoto(photo('a')));
      ids.push(result.current.addPhoto(photo('b')));
    });
    act(() => result.current.patchItem(ids[0], { x: 50 }));
    act(() => result.current.patchItem(ids[1], { x: 70 }));

    // Undo the move of "b", then of "a": each only touches its own photo.
    act(() => result.current.undo());
    expect(result.current.doc?.photos.map((p) => p.x)).toEqual([50, 0]);
    act(() => result.current.undo());
    expect(result.current.doc?.photos.map((p) => p.x)).toEqual([0, 0]);
  });

  it('drops the selection when undo takes the selected photo away', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    act(() => {
      result.current.addPhoto(photo('a'));
    });
    expect(result.current.selectedId).not.toBeNull();

    act(() => result.current.undo());

    expect(result.current.selectedId).toBeNull();
  });

  it('says when a gesture is under way, for autosave to wait on', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.beginGesture());
    expect(result.current.gestureActive).toBe(true);
    act(() => result.current.endGesture());
    expect(result.current.gestureActive).toBe(false);
  });
});

describe('select', () => {
  it('select sets and clears the selected id', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => result.current.select('some-id'));
    expect(result.current.selectedId).toBe('some-id');

    act(() => result.current.select(null));
    expect(result.current.selectedId).toBeNull();
  });
});

describe('stickers and shapes', () => {
  it('adds a sticker centred on the canvas and selects it', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    let id = '';
    act(() => {
      id = result.current.addSticker('🎉');
    });

    const sticker = result.current.doc!.texts[0]!;
    expect(sticker).toMatchObject({ id, kind: 'sticker', text: '🎉' });
    expect(sticker.width).toBe(sticker.height);
    expect(sticker.x + sticker.width / 2).toBe(800);
    expect(sticker.y + sticker.height / 2).toBe(450);
    expect(result.current.selectedItem).toMatchObject({ kind: 'sticker' });
  });

  it('adds a shape in the given colour', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));

    act(() => {
      result.current.addShape('star', '#00ff00');
    });

    expect(result.current.doc!.texts[0]).toMatchObject({ kind: 'shape', shape: 'star', color: '#00ff00' });
    expect(result.current.selectedItem).toMatchObject({ kind: 'shape' });
  });

  it('stores a restyled text the way a reload would read it back', () => {
    const { result } = renderHook(() => useCollageEditor());
    act(() => result.current.init(emptyDoc));
    let id = '';
    act(() => {
      id = result.current.addText();
    });

    act(() => result.current.patchItem(id, { bold: true, align: 'center', italic: true }));

    const text = result.current.doc!.texts[0]!;
    expect(text.bold).toBeUndefined();
    expect(text.align).toBeUndefined();
    expect(text.italic).toBe(true);
  });
});
