import { vi } from 'vitest';
import { exportCollageToPng, downloadBlob } from './exportCollage';
import { CollageDoc } from './collageDoc';
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
    texts: [{ id: 't1', text: 'Line one\nLine two', x: 0, y: 0, width: 200, height: 60, fontSize: 20, color: '#e91e63' }]
  };

  await exportCollageToPng(docWithText, resolvePhoto);

  expect(ctx.fillText).toHaveBeenCalledWith('Line one', 100, expect.any(Number), 200);
  expect(ctx.fillText).toHaveBeenCalledWith('Line two', 100, expect.any(Number), 200);
  expect(ctx.fillStyleHistory).toContain('#e91e63');
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

it('downloadBlob creates an object URL, triggers a click, and revokes the URL', () => {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const blob = new Blob(['data']);

  downloadBlob(blob, 'collage.png');

  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(clickSpy).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  clickSpy.mockRestore();
});
