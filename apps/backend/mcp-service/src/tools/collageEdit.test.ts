jest.mock('@tumbaland/backend-core', () => ({ requireEnv: (name: string) => process.env[name] ?? 'http://album-service:4002' }));

import { CollageDoc, CollagePhotoItem, CollageTextItem } from '@tumbaland/collage-core';
import { EditOp, planChanges } from './collageEdit';
import type { PhotoInfo } from './collageText';

const photo = (overrides: Partial<CollagePhotoItem> = {}): CollagePhotoItem => ({
  id: 'item-a',
  photoId: 'ph1',
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  rotation: 0,
  caption: '',
  ...overrides
});

const text = (overrides: Partial<CollageTextItem> = {}): CollageTextItem => ({
  id: 'item-t',
  text: 'Saaremaa',
  x: 100,
  y: 700,
  width: 600,
  height: 80,
  fontSize: 64,
  color: '#e91e63',
  ...overrides
});

const doc = (overrides: Partial<CollageDoc> = {}): CollageDoc => ({
  canvas: { width: 1600, height: 900 },
  background: '#fce4ec',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [photo(), photo({ id: 'item-b', photoId: 'ph2', x: 800 })],
  texts: [text()],
  ...overrides
});

const photos = new Map<string, PhotoInfo>([
  ['ph1', { name: 'beach.jpg', aspect: 4 / 3, video: false }],
  ['ph2', { name: 'harbour.jpg', aspect: 3 / 4, video: false }],
  ['ph3', { name: 'sauna.jpg', video: false }]
]);

const plan = (ops: EditOp[], start = doc()) => planChanges(start, ops, photos);

describe('placing photos', () => {
  it('puts a new photo on top, stored as the editor stores one, and names it', () => {
    const result = plan([{ op: 'place_photo', photo: 'ph3', x: 10, y: 20, width: 400, height: 300, caption: 'Hot' }]);

    const [change] = result.changes;
    expect(change).toMatchObject({
      type: 'put',
      layer: 'photos',
      item: { photoId: 'ph3', filename: 'ph3', x: 10, y: 20, position: { left: 10, top: 20 }, width: 400, height: 300, caption: 'Hot' }
    });
    expect(result.done).toEqual(['placed sauna.jpg as p3']);
  });

  it('keeps the part of the photo it is asked to', () => {
    // A 3:4 portrait in a square box: keep its top three quarters.
    const result = plan([{ op: 'place_photo', photo: 'ph2', x: 0, y: 0, width: 300, height: 300, focus: 'top' }]);
    expect(result.changes[0]).toMatchObject({ item: { crop: { x: 0, y: 0, width: 1, height: 0.75 } } });
  });

  it('crops nothing to keep the middle, since that is how a photo fills its box anyway', () => {
    const result = plan([{ op: 'place_photo', photo: 'ph2', x: 0, y: 0, width: 300, height: 300, focus: 'center' }]);
    expect((result.changes[0] as { item: { crop?: unknown } }).item.crop).toBeUndefined();
  });

  it('gives the box the photo’s own shape when asked for all of it', () => {
    const result = plan([{ op: 'place_photo', photo: 'ph1', x: 0, y: 0, width: 400, height: 999, fit: 'whole' }]);
    expect(result.changes[0]).toMatchObject({ item: { width: 400, height: 300 } });
  });

  it('leaves room for the frame when it fits a framed photo to its shape', () => {
    const result = plan([{ op: 'place_photo', photo: 'ph1', x: 0, y: 0, width: 424, height: 1, fit: 'whole', frame: true }]);
    expect(result.changes[0]).toMatchObject({ item: { height: 324 } });
  });

  it('refuses a photo from outside the collage’s albums, and says where to look', () => {
    expect(() => plan([{ op: 'place_photo', photo: 'nope', x: 0, y: 0, width: 1, height: 1 }])).toThrow(/view_photos/);
  });
});

describe('editing what is there', () => {
  it('moves and resizes a photo by its short name, keeping the rest', () => {
    const result = plan([{ op: 'edit', item: 'p2', x: 900, rotation: 5, caption: 'Harbour' }]);
    expect(result.changes[0]).toMatchObject({
      type: 'put',
      layer: 'photos',
      item: { id: 'item-b', photoId: 'ph2', x: 900, y: 0, width: 800, rotation: 5, caption: 'Harbour' }
    });
    expect(result.done).toEqual(['changed p2']);
  });

  it('swaps in another photo, dropping the old one’s crop and turn', () => {
    const start = doc({ photos: [photo({ crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 }, orientation: 90 })] });
    const result = plan([{ op: 'edit', item: 'p1', photo: 'ph3' }], start);

    const item = (result.changes[0] as { item: Record<string, unknown> }).item;
    expect(item).toMatchObject({ photoId: 'ph3' });
    expect(item.crop).toBeUndefined();
    expect(item.orientation).toBeUndefined();
  });

  it('recrops to a new focus, inside the frame', () => {
    // Framed, the picture area of a 824×624 box is 800×600, the photo's own shape.
    const start = doc({ frameEnabled: true, photos: [photo({ width: 824, height: 624 })] });
    const result = plan([{ op: 'edit', item: 'p1', focus: 'top' }], start);
    expect((result.changes[0] as { item: { crop?: unknown } }).item.crop).toBeUndefined();
  });

  it('shows the part of the photo it is given', () => {
    const result = plan([{ op: 'edit', item: 'p1', crop: { x: 0.1, y: 0, width: 0.5, height: 0.6 } }]);
    expect(result.changes[0]).toMatchObject({ item: { crop: { x: 0.1, y: 0, width: 0.5, height: 0.6 } } });
  });

  it('takes a crop of the whole photo as no crop', () => {
    const start = doc({ photos: [photo({ crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } })] });
    const result = plan([{ op: 'edit', item: 'p1', crop: { x: 0, y: 0, width: 1, height: 1 } }], start);
    expect((result.changes[0] as { item: { crop?: unknown } }).item.crop).toBeUndefined();
  });

  it('refuses a crop that runs off the photo, or one given with a focus', () => {
    expect(() => plan([{ op: 'edit', item: 'p1', crop: { x: 0.6, y: 0, width: 0.5, height: 1 } }])).toThrow(/inside the photo/);
    expect(() => plan([{ op: 'edit', item: 'p1', focus: 'top', crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }])).toThrow(
      /not both/
    );
  });

  it('says it cannot keep the top of a photo whose shape it does not know, rather than doing nothing', () => {
    const start = doc({ photos: [photo({ photoId: 'ph3' })] });
    expect(() => plan([{ op: 'edit', item: 'p1', focus: 'top' }], start)).toThrow(/shape of sauna.jpg is not known/);
    expect(() => plan([{ op: 'place_photo', photo: 'ph3', x: 0, y: 0, width: 400, height: 1, fit: 'whole' }])).toThrow(
      /cannot be fitted whole/
    );
  });

  it('shows all of a photo inside its box, dropping its crop and keeping the box', () => {
    const start = doc({ photos: [photo({ crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } })] });
    const result = plan([{ op: 'edit', item: 'p1', fit: 'inside' }], start);

    const item = (result.changes[0] as { item: Record<string, unknown> }).item;
    expect(item).toMatchObject({ fit: 'contain', width: 800, height: 600 });
    expect(item.crop).toBeUndefined();
  });

  it('puts a photo back to filling its box', () => {
    const start = doc({ photos: [photo({ fit: 'contain' })] });
    const item = (plan([{ op: 'edit', item: 'p1', fit: 'fill', focus: 'top' }], start).changes[0] as { item: Record<string, unknown> })
      .item;
    expect(item.fit).toBeUndefined();
  });

  it('refuses to crop a photo shown whole, and says how to', () => {
    const start = doc({ photos: [photo({ fit: 'contain' })] });
    expect(() => plan([{ op: 'edit', item: 'p1', focus: 'top' }], start)).toThrow(/fit "fill"/);
    expect(() => plan([{ op: 'edit', item: 'p1', fit: 'inside', crop: { x: 0, y: 0, width: 0.5, height: 0.5 } }])).toThrow(
      /no crop or focus/
    );
  });

  it('gives an existing photo’s box the photo’s shape', () => {
    // ph2 is 3:4: an 800-wide box becomes 1067 tall.
    const result = plan([{ op: 'edit', item: 'p2', fit: 'whole' }]);
    expect(result.changes[0]).toMatchObject({ item: { width: 800, height: 1067 } });
  });

  it('places a photo shown whole', () => {
    const result = plan([{ op: 'place_photo', photo: 'ph3', x: 0, y: 0, width: 300, height: 300, fit: 'inside' }]);
    expect(result.changes[0]).toMatchObject({ item: { photoId: 'ph3', fit: 'contain' } });
  });

  it('restyles a text, writing defaults as nothing', () => {
    const result = plan([{ op: 'edit', item: 't1', text: 'Suvi', font: 'Handwritten', size: 80, bold: true, align: 'center', outline: '' }]);
    const item = (result.changes[0] as { item: Record<string, unknown> }).item;

    expect(item).toMatchObject({ id: 'item-t', text: 'Suvi', fontFamily: 'hand', fontSize: 80 });
    expect(item).not.toHaveProperty('bold');
    expect(item).not.toHaveProperty('align');
    expect(item).not.toHaveProperty('outline');
  });

  it('changes a shape', () => {
    const start = doc({ texts: [text({ kind: 'shape', shape: 'heart', text: '' })] });
    expect(plan([{ op: 'edit', item: 't1', shape: 'star', color: '#ffc107' }], start).changes[0]).toMatchObject({
      item: { shape: 'star', color: '#ffc107' }
    });
  });

  it('names a font or a shape it does not know, with the ones it does', () => {
    expect(() => plan([{ op: 'edit', item: 't1', font: 'Comic Sans' }])).toThrow(/Handwritten/);
    expect(() => plan([{ op: 'edit', item: 't1', shape: 'blob' }])).toThrow(/heart/);
  });

  it('builds a later edit on an earlier one to the same item', () => {
    const result = plan([
      { op: 'edit', item: 'p1', x: 50 },
      { op: 'edit', item: 'p1', y: 60 }
    ]);
    expect(result.changes[1]).toMatchObject({ item: { x: 50, y: 60 } });
  });

  it('accepts an item’s own id as well as its short name', () => {
    expect(plan([{ op: 'edit', item: 'item-b', x: 1 }]).changes[0]).toMatchObject({ item: { id: 'item-b' } });
  });

  it('says to read again when it does not know the name', () => {
    expect(() => plan([{ op: 'edit', item: 'p9', x: 1 }])).toThrow(/get_collage/);
  });
});

describe('removing and restacking', () => {
  it('resolves every name before anything moves, so a removal does not renumber the rest', () => {
    const result = plan([
      { op: 'remove', item: 'p1' },
      { op: 'edit', item: 'p2', x: 0 }
    ]);

    expect(result.changes[0]).toEqual({ type: 'remove', layer: 'photos', id: 'item-a' });
    expect(result.changes[1]).toMatchObject({ item: { id: 'item-b', x: 0 } });
  });

  it('says so when an item removed earlier in the batch is edited', () => {
    expect(() =>
      plan([
        { op: 'remove', item: 't1' },
        { op: 'edit', item: 't1', text: 'x' }
      ])
    ).toThrow(/removed earlier/);
  });

  it('says so when an item is removed twice in the batch', () => {
    expect(() =>
      plan([
        { op: 'remove', item: 'p1' },
        { op: 'remove', item: 'p1' }
      ])
    ).toThrow(/removed earlier/);
  });

  it('moves items to the front or back of their own layer', () => {
    const front = plan([{ op: 'to_front', items: ['p1'] }]);
    expect(front.changes).toEqual([{ type: 'order', layer: 'photos', ids: ['item-b', 'item-a'] }]);

    const back = plan([{ op: 'to_back', items: ['p2', 't1'] }]);
    expect(back.changes).toEqual([
      { type: 'order', layer: 'photos', ids: ['item-b', 'item-a'] },
      { type: 'order', layer: 'texts', ids: ['item-t'] }
    ]);
  });
});

describe('adding texts, stickers and shapes', () => {
  it('gives a text a box it fits when none is given', () => {
    const result = plan([{ op: 'add_text', text: 'Hello\nthere', x: 0, y: 0, size: 40, font: 'poster' }]);

    expect(result.changes[0]).toMatchObject({
      layer: 'texts',
      item: { text: 'Hello\nthere', fontSize: 40, fontFamily: 'poster', width: 160, height: 108, color: '#e91e63' }
    });
    expect(result.done).toEqual(['added text "Hello\nthere" as t2']);
  });

  it('sizes a sticker as a square', () => {
    const result = plan([{ op: 'add_sticker', emoji: '🎉', x: 5, y: 5, size: 120, rotation: 10 }]);
    expect(result.changes[0]).toMatchObject({ item: { kind: 'sticker', text: '🎉', width: 120, height: 120, rotation: 10 } });
  });

  it('adds a shape in its colour', () => {
    const result = plan([{ op: 'add_shape', shape: 'heart', x: 0, y: 0, width: 100, height: 90, color: '#f00', outline: '#000' }]);
    expect(result.changes[0]).toMatchObject({ item: { kind: 'shape', shape: 'heart', color: '#f00', outline: '#000' } });
  });
});

describe('settings', () => {
  it('writes the collage-wide settings under the keys they are stored as', () => {
    const result = plan([{ op: 'settings', background: '#000000', frame: true, width: 1080 }]);
    expect(result.changes).toEqual([
      {
        type: 'settings',
        values: {
          viewport: { width: 1080, height: 900 },
          backgroundColor: '#000000',
          borderColor: '#ffffff',
          photoTransparencyMode: false
        }
      }
    ]);
    expect(result.doc.frameEnabled).toBe(true);
  });
});
