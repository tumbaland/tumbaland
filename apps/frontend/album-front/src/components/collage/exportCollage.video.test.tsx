import { vi } from 'vite-plus/test';
import { exportCollageToPng, exportCollageToVideo, pickVideoFormat } from './exportCollage';
import { CollageDoc } from '@tumbaland/collage-core';
import { ResolvePhoto } from './CollageStage';

/**
 * Recording a collage leans on browser pieces jsdom does not have: a canvas
 * that can stream, MediaRecorder, a video that loads, and WebCodecs' ImageDecoder.
 * Each is stood in for here, so what is tested is the exporter's own decisions:
 * which format, how long a clip, what happens to a photo that will not load.
 */

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  crossOrigin = '';
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

type VideoMode = 'loads' | 'fails' | 'never';

class FakeVideo {
  static mode: VideoMode = 'loads';
  static playFails = false;
  static instances: FakeVideo[] = [];
  onloadeddata: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onseeked: (() => void) | null = null;
  muted = false;
  loop = false;
  playsInline = false;
  preload = '';
  crossOrigin = '';
  videoWidth = 640;
  videoHeight = 360;
  duration = 5;
  play = vi.fn(() => (FakeVideo.playFails ? Promise.reject(new Error('blocked')) : Promise.resolve()));
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
  private _currentTime = 0;
  constructor() {
    FakeVideo.instances.push(this);
  }
  get currentTime() {
    return this._currentTime;
  }
  set currentTime(value: number) {
    this._currentTime = value;
    queueMicrotask(() => this.onseeked?.());
  }
  set src(_value: string) {
    if (FakeVideo.mode === 'loads') queueMicrotask(() => this.onloadeddata?.());
    if (FakeVideo.mode === 'fails') queueMicrotask(() => this.onerror?.());
  }
}

class FakeMediaRecorder {
  static supported = new Set<string>(['video/webm']);
  static isTypeSupported = (type: string) => FakeMediaRecorder.supported.has(type);
  static last: FakeMediaRecorder | undefined;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn();
  constructor(
    public stream: unknown,
    public options: { mimeType: string }
  ) {
    FakeMediaRecorder.last = this;
  }
  stop() {
    this.ondataavailable?.({ data: new Blob(['chunk']) });
    this.ondataavailable?.({ data: new Blob([]) });
    this.onstop?.();
  }
}

const makeCtx = () => ({
  scale: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  drawImage: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  fillStyle: '',
  shadowColor: '',
  shadowBlur: 0,
  shadowOffsetY: 0,
  font: '',
  textAlign: '',
  textBaseline: ''
});

const doc: CollageDoc = {
  canvas: { width: 400, height: 300 },
  background: '#111111',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [{ id: 'p1', photoId: 'photo-1', x: 10, y: 10, width: 100, height: 80, rotation: 0, caption: '' }],
  texts: []
};

const resolving =
  (resolved: ReturnType<ResolvePhoto>): ResolvePhoto =>
  () =>
    resolved;

const trackStop = vi.fn();
let ctx: ReturnType<typeof makeCtx>;
let captureStream: ReturnType<typeof vi.fn>;

/** Runs an export to the end on the fake clock, where it records in real time. */
const finish = async <T,>(promise: Promise<T>): Promise<T> => {
  // Attached first, so a rejection is never left unhandled while the clock runs.
  const settled = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error })
  );
  await vi.advanceTimersByTimeAsync(25_000);
  const result = await settled;
  if ('error' in result) throw result.error;
  return result.value;
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance']
  });
  FakeVideo.mode = 'loads';
  FakeVideo.playFails = false;
  FakeVideo.instances = [];
  FakeMediaRecorder.supported = new Set(['video/webm']);
  FakeMediaRecorder.last = undefined;
  trackStop.mockClear();

  vi.stubGlobal('Image', FakeImage as unknown as typeof Image);
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);

  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) =>
    tag === 'video' ? new FakeVideo() : realCreateElement(tag, options)) as never);

  ctx = makeCtx();
  captureStream = vi.fn(() => ({ getTracks: () => [{ stop: trackStop }] }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(((cb: (blob: Blob | null) => void) =>
    cb(new Blob(['png'], { type: 'image/png' }))) as never);
  (HTMLCanvasElement.prototype as unknown as { captureStream: unknown }).captureStream = captureStream;
});

afterEach(() => {
  delete (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('pickVideoFormat', () => {
  it('takes the best format the browser can record', () => {
    FakeMediaRecorder.supported = new Set(['video/mp4', 'video/webm']);

    expect(pickVideoFormat()).toEqual({ mimeType: 'video/mp4', extension: 'mp4' });
  });

  it('falls back to WebM where MP4 is not recorded', () => {
    expect(pickVideoFormat()).toEqual({ mimeType: 'video/webm', extension: 'webm' });
  });

  it('offers nothing when no format is supported, or the check does not exist', () => {
    FakeMediaRecorder.supported = new Set();
    expect(pickVideoFormat()).toBeNull();

    vi.stubGlobal('MediaRecorder', class {});
    expect(pickVideoFormat()).toBeNull();
  });
});

describe('exportCollageToVideo', () => {
  it('records a still collage for the minimum clip length and reports progress', async () => {
    const onProgress = vi.fn();

    const result = await finish(exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/a.jpg' }), onProgress));

    expect(result.extension).toBe('webm');
    expect(result.blob.type).toBe('video/webm');
    expect(result.blob.size).toBeGreaterThan(0);
    expect(FakeMediaRecorder.last?.start).toHaveBeenCalledWith(250);
    expect(captureStream).toHaveBeenCalledWith(30);
    expect(onProgress).toHaveBeenLastCalledWith(1);
    expect(trackStop).toHaveBeenCalled();
  });

  it('records at the size of the collage, scaled down to fit the long edge', async () => {
    const big: CollageDoc = { ...doc, canvas: { width: 3840, height: 2160 } };

    await finish(exportCollageToVideo(big, resolving({ src: 'https://cdn.example/a.jpg' })));

    // 1920 / 3840 = 0.5, so the scene is drawn at half size rather than 2x.
    expect(ctx.scale).toHaveBeenCalledWith(0.5, 0.5);
  });

  it('plays a video from the start and lets it set the clip length', async () => {
    const result = await finish(
      exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/clip.mp4', mimetype: 'video/mp4' }))
    );

    const [video] = FakeVideo.instances;
    expect(video.muted).toBe(true);
    expect(video.play).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(result.blob.size).toBeGreaterThan(0);
    // Done with: stopped and let go of, so it does not keep downloading.
    expect(video.pause).toHaveBeenCalled();
    expect(video.removeAttribute).toHaveBeenCalledWith('src');
    expect(video.load).toHaveBeenCalled();
  });

  it('does not mind a video that refuses to play', async () => {
    FakeVideo.playFails = true;

    const result = await finish(
      exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/clip.mp4', mimetype: 'video/mp4' }))
    );

    expect(FakeVideo.instances[0].play).toHaveBeenCalled();
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('leaves out a video that fails to load, without failing the export', async () => {
    FakeVideo.mode = 'fails';

    const result = await finish(
      exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/clip.mp4', mimetype: 'video/mp4' }))
    );

    expect(result.blob).toBeInstanceOf(Blob);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('gives up on a video that never loads', async () => {
    FakeVideo.mode = 'never';

    const result = await finish(
      exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/clip.mp4', mimetype: 'video/mp4' }))
    );

    expect(result.blob).toBeInstanceOf(Blob);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('has nothing to draw for a photo that cannot be resolved', async () => {
    await finish(exportCollageToVideo(doc, () => undefined));

    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('draws a GIF as a still where the browser cannot decode its frames', async () => {
    await finish(exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/a.gif', mimetype: 'image/gif' })));

    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('says so when the browser cannot record at all', async () => {
    FakeMediaRecorder.supported = new Set();

    await expect(exportCollageToVideo(doc, resolving({ src: 'x' }))).rejects.toThrow(/cannot record video/);
  });

  it('says so when the canvas cannot be streamed', async () => {
    delete (HTMLCanvasElement.prototype as unknown as { captureStream?: unknown }).captureStream;

    await expect(exportCollageToVideo(doc, resolving({ src: 'x' }))).rejects.toThrow(
      'This browser cannot record video.'
    );
  });

  it('explains CORS when a tainted canvas cannot be streamed', async () => {
    captureStream.mockImplementation(() => {
      throw new Error('SecurityError');
    });

    await expect(finish(exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/a.jpg' })))).rejects.toThrow(
      /CORS/
    );
  });

  it('fails when the recorder does', async () => {
    const promise = finish(exportCollageToVideo(doc, resolving({ src: 'https://cdn.example/a.jpg' })));
    // Replaces the recorder's stop with an error, as a browser would on a failed encode.
    await vi.advanceTimersByTimeAsync(10);
    const recorder = FakeMediaRecorder.last!;
    recorder.stop = () => recorder.onerror?.();

    await expect(promise).rejects.toThrow('Recording the video failed');
  });
});

describe('a GIF decoded frame by frame', () => {
  const frame = (duration: number | null) => ({
    duration,
    displayWidth: 320,
    displayHeight: 240,
    close: vi.fn()
  });

  const stubDecoder = (frames: ReturnType<typeof frame>[]) => {
    const close = vi.fn();
    class FakeDecoder {
      tracks = { ready: Promise.resolve(), selectedTrack: { frameCount: frames.length } };
      decode = vi.fn(async ({ frameIndex }: { frameIndex: number }) => ({ image: frames[frameIndex] }));
      close = close;
    }
    vi.stubGlobal('ImageDecoder', FakeDecoder);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    return close;
  };

  const gif = resolving({ src: 'https://cdn.example/a.gif', mimetype: 'image/gif' });

  it('draws the decoded frames and releases them afterwards', async () => {
    const frames = [frame(100_000), frame(null), frame(200_000)];
    const closeDecoder = stubDecoder(frames);

    await finish(exportCollageToVideo(doc, gif));

    expect(closeDecoder).toHaveBeenCalled();
    const drawn = ctx.drawImage.mock.calls.map(([source]) => source);
    expect(drawn).toContain(frames[0]);
    expect(drawn.some((source) => source === frames[1] || source === frames[2])).toBe(true);
    frames.forEach((each) => expect(each.close).toHaveBeenCalled());
  });

  it('falls back to a still when the GIF cannot be fetched', async () => {
    stubDecoder([frame(100_000)]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await finish(exportCollageToVideo(doc, gif));

    // The still is the fake Image, not a decoded frame.
    expect(ctx.drawImage.mock.calls[0][0]).toBeInstanceOf(FakeImage);
  });
});

describe('a video in the PNG without a poster', () => {
  it('takes a frame from the video itself', async () => {
    const result = await exportCollageToPng(
      doc,
      resolving({ src: 'https://cdn.example/clip.mp4', mimetype: 'video/mp4' })
    );

    expect(result.type).toBe('image/png');
    const [video] = FakeVideo.instances;
    expect(video.currentTime).toBe(0.1);
    expect(ctx.drawImage.mock.calls[0][0]).toBe(video);
  });
});
