import { describe, it, expect } from 'vite-plus/test';
import { CollageDoc, CollagePhotoItem } from './doc';
import { drawCover, FRAME_PADDING, renderScene, wholePhotoBlur } from './render';
import { fakeEnv, named, recordingContext } from './testUtils';

const photo = (overrides: Partial<CollagePhotoItem> = {}): CollagePhotoItem => ({
  id: 'p1',
  photoId: 'ph1',
  x: 100,
  y: 50,
  width: 400,
  height: 300,
  rotation: 0,
  caption: '',
  ...overrides
});

const doc = (overrides: Partial<CollageDoc> = {}): CollageDoc => ({
  canvas: { width: 1600, height: 900 },
  background: '#123456',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [],
  texts: [],
  ...overrides
});

const picture = { source: 'img', width: 800, height: 600 };

describe('drawCover', () => {
  it('samples the middle of a picture wider than its box', () => {
    const ctx = recordingContext();
    drawCover(ctx, { source: 'img', width: 200, height: 100 }, 0, 0, 100, 100);
    expect(named(ctx.calls, 'drawImage')[0]!.args).toEqual(['img', 50, 0, 100, 100, 0, 0, 100, 100]);
  });

  it('samples the middle of a picture taller than its box', () => {
    const ctx = recordingContext();
    drawCover(ctx, { source: 'img', width: 100, height: 200 }, 0, 0, 100, 100);
    expect(named(ctx.calls, 'drawImage')[0]!.args).toEqual(['img', 0, 50, 100, 100, 0, 0, 100, 100]);
  });

  it('samples only the cropped region', () => {
    const ctx = recordingContext();
    drawCover(ctx, picture, 0, 0, 400, 300, { x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    expect(named(ctx.calls, 'drawImage')[0]!.args).toEqual(['img', 400, 300, 400, 300, 0, 0, 400, 300]);
  });
});

describe('a whole photo', () => {
  it('draws all of it inside the box, on a blurred copy that covers the box', () => {
    const ctx = recordingContext();
    // A 4:3 picture in a square box: as wide as the box, centred top to bottom.
    renderScene(ctx, doc({ photos: [photo({ width: 400, height: 400, fit: 'contain' })] }), () => picture);

    const [behind, whole] = named(ctx.calls, 'drawImage');
    expect(behind!.filter).toBe(`blur(${wholePhotoBlur(400, 400)}px)`);
    expect(named(ctx.calls, 'clip')).toHaveLength(1);
    expect(whole!.filter).toBe('none');
    expect(whole!.args).toEqual(['img', 0, 0, 800, 600, -200, -150, 400, 300]);
  });

  it('blurs by the same share of the box when the drawing is scaled down', () => {
    const ctx = Object.assign(recordingContext(), { getTransform: () => ({ a: 0.5, b: 0 }) });
    renderScene(ctx, doc({ photos: [photo({ width: 400, height: 400, fit: 'contain' })] }), () => picture);
    expect(named(ctx.calls, 'drawImage')[0]!.filter).toBe(`blur(${wholePhotoBlur(400, 400) / 2}px)`);
  });

  it('shows all of it even when it has a crop', () => {
    const ctx = recordingContext();
    renderScene(
      ctx,
      doc({ photos: [photo({ fit: 'contain', crop: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 } })] }),
      () => picture
    );
    expect(named(ctx.calls, 'drawImage')[1]!.args.slice(1, 5)).toEqual([0, 0, 800, 600]);
  });
});

describe('renderScene', () => {
  it('fills the background first, over the whole canvas', () => {
    const ctx = recordingContext();
    renderScene(ctx, doc(), () => undefined);
    expect(ctx.calls[0]).toMatchObject({ name: 'fillRect', args: [0, 0, 1600, 900], fillStyle: '#123456' });
  });

  it('draws a photo into its box, about its centre', () => {
    const ctx = recordingContext();
    renderScene(ctx, doc({ photos: [photo()] }), () => picture);

    expect(named(ctx.calls, 'translate')[0]!.args).toEqual([300, 200]);
    expect(named(ctx.calls, 'drawImage')[0]!.args).toEqual(['img', 0, 0, 800, 600, -200, -150, 400, 300]);
  });

  it('turns a tilted photo', () => {
    const ctx = recordingContext();
    renderScene(ctx, doc({ photos: [photo({ rotation: 90 })] }), () => picture);
    expect(named(ctx.calls, 'rotate')[0]!.args[0]).toBeCloseTo(Math.PI / 2);
  });

  it('draws a frame and sets the picture inside it', () => {
    const ctx = recordingContext();
    renderScene(ctx, doc({ frameEnabled: true, frameColor: '#fafafa', photos: [photo()] }), () => picture);

    const frame = named(ctx.calls, 'fillRect')[1]!;
    expect(frame).toMatchObject({ args: [-200, -150, 400, 300], fillStyle: '#fafafa' });
    const [, , , , , x, y, w, h] = named(ctx.calls, 'drawImage')[0]!.args as number[];
    expect([x, y, w, h]).toEqual([-200 + FRAME_PADDING, -150 + FRAME_PADDING, 400 - FRAME_PADDING * 2, 300 - FRAME_PADDING * 2]);
  });

  it('shows a missing picture as a grey box rather than a gap', () => {
    const ctx = recordingContext();
    renderScene(ctx, doc({ photos: [photo()] }), () => undefined);

    expect(named(ctx.calls, 'drawImage')).toHaveLength(0);
    expect(named(ctx.calls, 'fillRect')[1]).toMatchObject({ args: [-200, -150, 400, 300], fillStyle: 'rgba(128,128,128,0.4)' });
  });

  it('draws a picture turned on its side within the same box', () => {
    const ctx = recordingContext();
    renderScene(ctx, doc({ photos: [photo({ orientation: 90 })] }), () => picture);

    // The box is drawn on its side, so width and height trade places.
    const [, , , , , , , w, h] = named(ctx.calls, 'drawImage')[0]!.args as number[];
    expect([w, h]).toEqual([300, 400]);
  });

  it('writes a caption along the bottom of the picture', () => {
    const ctx = recordingContext();
    renderScene(ctx, doc({ photos: [photo({ caption: 'Tallinn' })] }), () => picture);
    expect(named(ctx.calls, 'fillText')[0]!.args[0]).toBe('Tallinn');
  });

  it('draws texts and shapes over the photos, with the shapes from the given env', () => {
    const ctx = recordingContext();
    renderScene(
      ctx,
      doc({
        photos: [photo()],
        texts: [
          { id: 't1', text: 'Hi', x: 0, y: 0, width: 200, height: 50, fontSize: 32, color: '#000' },
          { id: 's1', text: '', kind: 'shape', shape: 'heart', x: 0, y: 0, width: 100, height: 100, fontSize: 32, color: '#f00' }
        ]
      }),
      () => picture,
      fakeEnv()
    );

    const drawn = ctx.calls.map((call) => call.name);
    expect(drawn.lastIndexOf('drawImage')).toBeLessThan(drawn.indexOf('fillText'));
    expect(named(ctx.calls, 'fill')).toHaveLength(1);
  });
});
