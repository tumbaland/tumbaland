import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOWNSCALE_THRESHOLD_BYTES, MAX_IMAGE_EDGE, captureVideoPoster, downscaleImage } from './mediaPrep';

/** A File of a given size and type, without allocating the bytes. */
function fileOf(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** Drives the <img> the downscaler loads, so tests control its dimensions. */
function stubImage(width: number, height: number, fail = false) {
  class StubImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    width = width;
    height = height;
    set src(_value: string) {
      setTimeout(() => (fail ? this.onerror?.() : this.onload?.()), 0);
    }
  }
  vi.stubGlobal('Image', StubImage);
}

/** A canvas whose toBlob yields a blob of a chosen size. */
function stubCanvas(blobSize: number, context: unknown = { drawImage: vi.fn() }) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: (callback: (blob: Blob | null) => void, type: string) => {
      const blob = new Blob(['x'], { type });
      Object.defineProperty(blob, 'size', { value: blobSize });
      callback(blob);
    }
  };
  // The original is captured before spying, so non-canvas tags still work.
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : realCreateElement(tag)
  );
  return canvas;
}

beforeEach(() => {
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn()
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('downscaleImage', () => {
  it('leaves a small photo alone rather than re-encoding it', async () => {
    const file = fileOf('small.jpg', 'image/jpeg', DOWNSCALE_THRESHOLD_BYTES - 1);

    const result = await downscaleImage(file);

    // Re-encoding a small file only loses quality.
    expect(result.blob).toBe(file);
  });

  it.each([
    ['image/gif', 'an animated GIF would flatten to one frame'],
    ['image/heic', 'HEIC is converted by the service, which keeps the original'],
    ['image/heif', 'HEIF is handled the same way']
  ])('passes %s through untouched, because %s', async (type) => {
    const file = fileOf('photo', type, 8_000_000);

    expect((await downscaleImage(file)).blob).toBe(file);
  });

  it('shrinks an oversized photo and reports its new dimensions', async () => {
    stubImage(4000, 3000);
    stubCanvas(500_000);
    const file = fileOf('big.jpg', 'image/jpeg', 8_000_000);

    const result = await downscaleImage(file);

    expect(result.mimetype).toBe('image/jpeg');
    expect(result.width).toBe(MAX_IMAGE_EDGE);
    expect(result.height).toBe(Math.round(3000 * (MAX_IMAGE_EDGE / 4000)));
    expect(result.blob.size).toBe(500_000);
  });

  it('renames a converted file so its extension matches its type', async () => {
    stubImage(4000, 3000);
    stubCanvas(500_000);

    const result = await downscaleImage(fileOf('holiday.png', 'image/png', 8_000_000));

    expect(result.filename).toBe('holiday.jpg');
  });

  it('keeps a large photo whose dimensions are already small', async () => {
    stubImage(800, 600);
    const file = fileOf('flat.jpg', 'image/jpeg', 2_000_000);

    const result = await downscaleImage(file);

    expect(result.blob).toBe(file);
    expect(result.width).toBe(800);
  });

  it('keeps the original when re-encoding would make it bigger', async () => {
    stubImage(4000, 3000);
    // A photo of a flat colour can re-encode larger than it started.
    stubCanvas(9_000_000);
    const file = fileOf('big.jpg', 'image/jpeg', 8_000_000);

    expect((await downscaleImage(file)).blob).toBe(file);
  });

  it('keeps the original when the image cannot be decoded', async () => {
    stubImage(0, 0, true);
    const file = fileOf('broken.jpg', 'image/jpeg', 8_000_000);

    // Uploading a large file is a better outcome than failing to send one.
    expect((await downscaleImage(file)).blob).toBe(file);
  });

  it('keeps the original when there is no 2D context', async () => {
    stubImage(4000, 3000);
    stubCanvas(100, null);
    const file = fileOf('big.jpg', 'image/jpeg', 8_000_000);

    expect((await downscaleImage(file)).blob).toBe(file);
  });
});

/** Drives the <video> the poster capture creates. */
function stubVideo(options: { width?: number; height?: number; duration?: number; fail?: boolean } = {}) {
  const video: Record<string, unknown> = {
    muted: false,
    playsInline: false,
    preload: '',
    videoWidth: options.width ?? 1920,
    videoHeight: options.height ?? 1080,
    duration: options.duration ?? 10,
    currentTime: 0,
    onloadeddata: null,
    onseeked: null,
    onerror: null,
    removeAttribute: vi.fn()
  };

  Object.defineProperty(video, 'src', {
    set() {
      setTimeout(() => {
        if (options.fail) {
          (video.onerror as (() => void) | null)?.();
          return;
        }
        (video.onloadeddata as (() => void) | null)?.();
        (video.onseeked as (() => void) | null)?.();
      }, 0);
    }
  });
  return video;
}

function stubMediaElements(video: Record<string, unknown>, canvasBlob: Blob | null = new Blob(['p'])) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
    toBlob: (callback: (blob: Blob | null) => void) => callback(canvasBlob)
  };
  vi.spyOn(document, 'createElement').mockImplementation(
    (tag: string) => (tag === 'video' ? video : canvas) as unknown as HTMLElement
  );
}

describe('captureVideoPoster', () => {
  it('captures a frame with the clip’s dimensions and duration', async () => {
    stubMediaElements(stubVideo({ width: 1280, height: 720, duration: 30 }));

    const poster = await captureVideoPoster(fileOf('clip.mp4', 'video/mp4', 5_000_000));

    expect(poster).toMatchObject({ width: 1280, height: 720, durationMs: 30_000 });
  });

  it('mutes and plays inline, which iOS requires before it will decode anything', async () => {
    const video = stubVideo();
    stubMediaElements(video);

    await captureVideoPoster(fileOf('clip.mp4', 'video/mp4', 1000));

    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
  });

  it('seeks past the opening frame, which is black in many clips', async () => {
    const video = stubVideo({ duration: 30 });
    stubMediaElements(video);

    await captureVideoPoster(fileOf('clip.mp4', 'video/mp4', 1000));

    expect(video.currentTime).toBeGreaterThan(0);
  });

  it('returns null when the browser cannot decode the format', async () => {
    stubMediaElements(stubVideo({ fail: true }));

    // A missing poster costs a grey rectangle; throwing would stop the send.
    expect(await captureVideoPoster(fileOf('clip.mov', 'video/quicktime', 1000))).toBeNull();
  });

  it('returns null for a video with no dimensions', async () => {
    stubMediaElements(stubVideo({ width: 0, height: 0 }));

    expect(await captureVideoPoster(fileOf('clip.mp4', 'video/mp4', 1000))).toBeNull();
  });

  it('returns null when the canvas produces no blob', async () => {
    stubMediaElements(stubVideo(), null);

    expect(await captureVideoPoster(fileOf('clip.mp4', 'video/mp4', 1000))).toBeNull();
  });
});
