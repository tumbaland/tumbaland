import { vi } from 'vite-plus/test';
import { collageMoves, exportCollageToPng, exportCollageToVideo, frameIndexAt } from './exportCollage';
import { CollageDoc } from '@tumbaland/collage-core';
import { ResolvePhoto } from './CollageStage';

/** Defaults to a successful image load; flip FakeImage.nextFails per-test to
 * exercise the "skip a photo that fails to load" branch (matches the
 * FileUpload.test.tsx precedent for stubbing the global Image). */
class FakeImage {
  static nextFails = false;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  crossOrigin = '';
  private _src = '';
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (FakeImage.nextFails) this.onerror?.();
      else this.onload?.();
    });
  }
  get src() {
    return this._src;
  }
}

function makeCtx() {
  const fillStyleHistory: string[] = [];
  let fillStyle = '';
  return {
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    beginPath: vi.fn(),
    roundRect: vi.fn(),
    // Ten pixels a character, so wrapping is easy to predict.
    measureText: vi.fn((text: string) => ({ width: text.length * 10 })),
    lineWidth: 0,
    lineJoin: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    font: '',
    textAlign: '',
    textBaseline: '',
    fillStyleHistory,
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(v: string) {
      fillStyle = v;
      fillStyleHistory.push(v);
    }
  };
}

const baseDoc: CollageDoc = {
  canvas: { width: 400, height: 300 },
  background: '#111111',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [{ id: 'p1', photoId: 'photo-1', x: 10, y: 10, width: 100, height: 80, rotation: 0, caption: '' }],
  texts: []
};

let ctx: ReturnType<typeof makeCtx>;
let getContextMock: ReturnType<typeof vi.fn>;
let toBlobMock: ReturnType<typeof vi.fn>;

const resolvePhoto: ResolvePhoto = (photoId) =>
  photoId === 'photo-1' ? { src: 'https://cdn.example/a.jpg', width: 800, height: 600 } : undefined;

beforeEach(() => {
  FakeImage.nextFails = false;
  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:mock'), revokeObjectURL: vi.fn() });

  ctx = makeCtx();
  getContextMock = vi.fn().mockReturnValue(ctx);
  toBlobMock = vi.fn((cb: (blob: Blob | null) => void) => cb(new Blob(['png'], { type: 'image/png' })));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContextMock as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(toBlobMock as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('throws when the canvas 2D context is unavailable', async () => {
  getContextMock.mockReturnValue(null);

  await expect(exportCollageToPng(baseDoc, resolvePhoto)).rejects.toThrow('Canvas is not supported in this browser');
});

it('fills the background and resolves with a PNG blob', async () => {
  const blob = await exportCollageToPng(baseDoc, resolvePhoto);

  expect(blob.type).toBe('image/png');
  expect(ctx.fillStyleHistory[0]).toBe('#111111');
  expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 400, 300);
});

it('draws a resolved photo image with cover semantics', async () => {
  await exportCollageToPng(baseDoc, resolvePhoto);

  expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  expect(ctx.translate).toHaveBeenCalledWith(10 + 100 / 2, 10 + 80 / 2);
});

it('draws a gray placeholder rect when the photo has no resolvable src', async () => {
  await exportCollageToPng(baseDoc, () => undefined);

  expect(ctx.drawImage).not.toHaveBeenCalled();
  expect(ctx.fillStyleHistory).toContain('rgba(128,128,128,0.4)');
});

it('skips a photo whose image fails to load, without failing the export', async () => {
  FakeImage.nextFails = true;

  const blob = await exportCollageToPng(baseDoc, resolvePhoto);

  expect(blob).toBeInstanceOf(Blob);
  expect(ctx.drawImage).not.toHaveBeenCalled();
  expect(ctx.fillStyleHistory).toContain('rgba(128,128,128,0.4)');
});

it('draws a frame background and padding when the photo is framed', async () => {
  const framedDoc: CollageDoc = {
    ...baseDoc,
    frameEnabled: true
  };

  await exportCollageToPng(framedDoc, resolvePhoto);

  expect(ctx.fillStyleHistory).toContain('#ffffff');
  // frame fillRect uses the un-padded photo box; the image draw is padded.
  expect(ctx.fillRect).toHaveBeenCalledWith(-50, -40, 100, 80);
});

it('draws a caption bar and text for a photo with a caption', async () => {
  const docWithCaption: CollageDoc = {
    ...baseDoc,
    photos: [{ ...baseDoc.photos[0], caption: 'Summer trip' }]
  };

  await exportCollageToPng(docWithCaption, resolvePhoto);

  expect(ctx.fillText).toHaveBeenCalledWith('Summer trip', expect.any(Number), expect.any(Number), expect.any(Number));
});

it('draws each line of a multi-line text item', async () => {
  const docWithText: CollageDoc = {
    ...baseDoc,
    photos: [],
    texts: [
      { id: 't1', text: 'Line one\nLine two', x: 0, y: 0, width: 200, height: 60, fontSize: 20, color: '#e91e63' }
    ]
  };

  await exportCollageToPng(docWithText, resolvePhoto);

  // Drawn about the item's centre, which the context is translated to.
  expect(ctx.translate).toHaveBeenCalledWith(100, 30);
  expect(ctx.fillText).toHaveBeenCalledWith('Line one', 0, expect.any(Number));
  expect(ctx.fillText).toHaveBeenCalledWith('Line two', 0, expect.any(Number));
  expect(ctx.fillStyleHistory).toContain('#e91e63');
});

it('wraps a long line to the width of its box, as the canvas on screen does', async () => {
  const doc: CollageDoc = {
    ...baseDoc,
    photos: [],
    texts: [{ id: 't1', text: 'one two three', x: 0, y: 0, width: 80, height: 60, fontSize: 20, color: '#000' }]
  };

  await exportCollageToPng(doc, resolvePhoto);

  expect(ctx.fillText.mock.calls.map(([line]) => line)).toEqual(['one two', 'three']);
});

it('draws a text in its font and style, turned, outlined, on its label', async () => {
  const doc: CollageDoc = {
    ...baseDoc,
    photos: [],
    texts: [
      {
        id: 't1',
        text: 'Hi',
        x: 0,
        y: 0,
        width: 200,
        height: 60,
        fontSize: 20,
        color: '#000000',
        fontFamily: 'hand',
        bold: false,
        italic: true,
        align: 'left',
        background: '#ffff00',
        outline: '#ffffff',
        rotation: 90
      }
    ]
  };

  await exportCollageToPng(doc, resolvePhoto);

  expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
  expect(ctx.font).toBe('italic 400 20px "Caveat", cursive');
  expect(ctx.fillStyleHistory).toContain('#ffff00');
  expect(ctx.roundRect).toHaveBeenCalled();
  expect(ctx.strokeText).toHaveBeenCalledWith('Hi', expect.any(Number), expect.any(Number));
  // left-aligned: starts at the box's left edge plus the label's padding
  expect(ctx.textAlign).toBe('left');
  expect(ctx.fillText.mock.calls[0][1]).toBeCloseTo(-100 + 20 * 0.3);
});

it('fills a shape with its colour and outlines it', async () => {
  class FakePath2D {
    addPath = vi.fn();
  }
  vi.stubGlobal('Path2D', FakePath2D);
  vi.stubGlobal(
    'DOMMatrix',
    class {
      translate() {
        return this;
      }
      scale() {
        return this;
      }
    }
  );
  const doc: CollageDoc = {
    ...baseDoc,
    photos: [],
    texts: [
      {
        id: 's1',
        kind: 'shape',
        shape: 'heart',
        text: '',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        fontSize: 32,
        color: '#e91e63',
        outline: '#ffffff'
      }
    ]
  };

  await exportCollageToPng(doc, resolvePhoto);

  expect(ctx.fill).toHaveBeenCalledWith(expect.any(FakePath2D));
  expect(ctx.stroke).toHaveBeenCalledWith(expect.any(FakePath2D));
  expect(ctx.fillText).not.toHaveBeenCalled();
});

it('draws a video from its poster in the PNG', async () => {
  const video: ResolvePhoto = () => ({
    src: 'https://cdn.example/clip.mp4',
    posterSrc: 'https://cdn.example/clip.jpg',
    mimetype: 'video/mp4'
  });

  await exportCollageToPng(baseDoc, video);

  const [image] = ctx.drawImage.mock.calls[0];
  expect((image as FakeImage).src).toBe('https://cdn.example/clip.jpg');
});

describe('moving collages', () => {
  it('knows a collage moves when it holds a GIF or a video', () => {
    expect(collageMoves(baseDoc, () => ({ mimetype: 'image/jpeg' }))).toBe(false);
    expect(collageMoves(baseDoc, () => ({ mimetype: 'image/gif' }))).toBe(true);
    expect(collageMoves(baseDoc, () => ({ mimetype: 'video/mp4' }))).toBe(true);
    expect(collageMoves(null, () => ({ mimetype: 'video/mp4' }))).toBe(false);
  });

  it("picks a GIF's frame by time, looping", () => {
    const durations = [0.1, 0.2, 0.1];
    expect(frameIndexAt(durations, 0)).toBe(0);
    expect(frameIndexAt(durations, 0.15)).toBe(1);
    expect(frameIndexAt(durations, 0.35)).toBe(2);
    expect(frameIndexAt(durations, 0.45)).toBe(0);
    expect(frameIndexAt([], 1)).toBe(0);
  });

  it('says so plainly where the browser cannot record video', async () => {
    vi.stubGlobal('MediaRecorder', undefined);
    await expect(exportCollageToVideo(baseDoc, resolvePhoto)).rejects.toThrow(/cannot record video/);
  });
});

it('rejects with a CORS-specific message when canvas.toBlob throws', async () => {
  toBlobMock.mockImplementation(() => {
    throw new Error('tainted canvas');
  });

  await expect(exportCollageToPng(baseDoc, resolvePhoto)).rejects.toThrow(/CORS/);
});

it('rejects when toBlob yields no blob', async () => {
  toBlobMock.mockImplementation((cb: (blob: Blob | null) => void) => cb(null));

  await expect(exportCollageToPng(baseDoc, resolvePhoto)).rejects.toThrow('Export failed');
});

it('draws only the crop region of a cropped photo', async () => {
  const doc: CollageDoc = {
    ...baseDoc,
    photos: [{ ...baseDoc.photos[0], crop: { x: 0.5, y: 0.25, width: 0.5, height: 0.5 } }]
  };

  await exportCollageToPng(doc, resolvePhoto);

  // source image is 800x600, so the region is 400x300 starting at 400,150;
  // the region is wider than the 100x80 box, so cover trims its sides
  const [, sx, sy, sw, sh, dx, dy, dw, dh] = ctx.drawImage.mock.calls[0];
  expect(sw).toBeCloseTo(375);
  expect(sh).toBeCloseTo(300);
  expect(sx).toBeCloseTo(400 + (400 - 375) / 2);
  expect(sy).toBeCloseTo(150);
  // the context is already translated to the item's centre
  expect([dx, dy, dw, dh]).toEqual([-50, -40, 100, 80]);
});

it('turns a sideways photo upright, drawing its box on its side', async () => {
  const doc: CollageDoc = {
    ...baseDoc,
    photos: [{ ...baseDoc.photos[0], orientation: 90 }]
  };

  await exportCollageToPng(doc, resolvePhoto);

  // the 100x80 box is rotated a quarter turn, so the image is drawn 80x100
  expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 2);
  const [, , , , , dx, dy, dw, dh] = ctx.drawImage.mock.calls[0];
  expect([dx, dy, dw, dh]).toEqual([-40, -50, 80, 100]);
});

it('samples a turned photo’s crop from the untouched source image', async () => {
  const doc: CollageDoc = {
    ...baseDoc,
    // right half of the turned picture == top half of the 800x600 file
    photos: [{ ...baseDoc.photos[0], orientation: 90, crop: { x: 0.5, y: 0, width: 0.5, height: 1 } }]
  };

  await exportCollageToPng(doc, resolvePhoto);

  // that region is the full 800 wide by 300 tall; the destination box is on
  // its side at 80x100, so cover keeps the region's full height and trims its
  // sides down to 240
  const [, sx, sy, sw, sh] = ctx.drawImage.mock.calls[0];
  expect(sw).toBeCloseTo(240);
  expect(sh).toBeCloseTo(300);
  expect(sx).toBeCloseTo((800 - 240) / 2);
  expect(sy).toBeCloseTo(0);
});

it('leaves an unturned photo on the plain draw path', async () => {
  await exportCollageToPng(baseDoc, resolvePhoto);

  // only the item's own (zero) rotation is applied — no extra quarter turn
  expect(ctx.rotate).toHaveBeenCalledTimes(1);
  expect(ctx.rotate).toHaveBeenCalledWith(0);
});
