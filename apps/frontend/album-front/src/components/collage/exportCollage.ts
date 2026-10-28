import { CollageDoc, Frame, isMovingType, isVideoType, renderScene } from '@tumbaland/collage-core';
import { loadFontsFor } from './collageElements';
import type { ResolvePhoto, ResolvedPhoto } from './CollageStage';

/**
 * Renders the collage document with an offscreen canvas: once, to a PNG, or
 * frame by frame while recording, to a video that keeps GIFs and videos moving.
 * What is drawn is @tumbaland/collage-core's renderScene, the same the server
 * uses for previews; this file loads the pictures and records.
 * Requires the image host to allow anonymous CORS; if a fetched image
 * taints the canvas, the export rejects with a descriptive error.
 */

const EXPORT_SCALE = 2; // render at 2x for print/share quality

const CORS_MESSAGE =
  'Export blocked by the image host (CORS). The collage still saves normally — use a screenshot as a fallback.';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for export'));
    img.src = src;
  });

const imageFrame = (img: HTMLImageElement): Frame => ({
  source: img,
  width: img.naturalWidth,
  height: img.naturalHeight
});

/** Gives up on a video that never loads, rather than hanging the export. */
const VIDEO_LOAD_TIMEOUT_MS = 15_000;

/** A video element, loaded far enough to draw, muted so it may play without a tap. */
const loadVideo = (src: string): Promise<HTMLVideoElement> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    const timer = setTimeout(() => reject(new Error('Video took too long to load')), VIDEO_LOAD_TIMEOUT_MS);
    video.onloadeddata = () => {
      clearTimeout(timer);
      resolve(video);
    };
    video.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Failed to load video for export'));
    };
    video.src = src;
  });

const videoFrame = (video: HTMLVideoElement): Frame => ({
  source: video,
  width: video.videoWidth,
  height: video.videoHeight
});

/** A still of a video for the PNG: its poster, or a frame a moment in. */
const videoStill = async (resolved: ResolvedPhoto): Promise<Frame> => {
  if (resolved.posterSrc) {
    try {
      return imageFrame(await loadImage(resolved.posterSrc));
    } catch {
      // no poster to be had; take a frame from the video itself
    }
  }
  const video = await loadVideo(resolved.src!);
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
    video.currentTime = Math.min(0.1, video.duration || 0.1);
  });
  return videoFrame(video);
};

const newCanvas = (doc: CollageDoc, scale: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(doc.canvas.width * scale);
  canvas.height = Math.round(doc.canvas.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.scale(scale, scale);
  return { canvas, ctx };
};

export const exportCollageToPng = async (doc: CollageDoc, resolvePhoto: ResolvePhoto): Promise<Blob> => {
  const { canvas, ctx } = newCanvas(doc, EXPORT_SCALE);

  // Load all images up front (missing ones are skipped, not fatal)
  const frames = new Map<string, Frame>();
  await Promise.all([
    loadFontsFor(doc.texts),
    ...doc.photos.map(async (photo) => {
      const resolved = resolvePhoto(photo.photoId);
      const src = resolved?.src || resolved?.thumbSrc;
      if (!resolved || !src) return;
      try {
        frames.set(
          photo.id,
          isVideoType(resolved.mimetype) ? await videoStill(resolved) : imageFrame(await loadImage(src))
        );
      } catch {
        // leave the photo out of the export rather than failing everything
      }
    })
  ]);

  renderScene(ctx, doc, (photo) => frames.get(photo.id));

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Export failed'));
      }, 'image/png');
    } catch {
      reject(new Error(CORS_MESSAGE));
    }
  });
};

/** Whether anything on the collage moves, so a video of it would differ from the picture. */
export const collageMoves = (doc: CollageDoc | null, resolvePhoto: ResolvePhoto): boolean =>
  Boolean(doc?.photos.some((photo) => isMovingType(resolvePhoto(photo.photoId)?.mimetype)));

/** Formats to record in, best first: MP4 plays everywhere, WebM is what most browsers record. */
const VIDEO_FORMATS = [
  { mimeType: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
  { mimeType: 'video/mp4', extension: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8', extension: 'webm' },
  { mimeType: 'video/webm', extension: 'webm' }
];

export const pickVideoFormat = (): { mimeType: string; extension: string } | null => {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return VIDEO_FORMATS.find((format) => MediaRecorder.isTypeSupported(format.mimeType)) ?? null;
};

/** Frame rate of the recording. */
const FPS = 30;
/** Long edge of the video, in pixels: 1080p for a 16:9 collage. */
const VIDEO_LONG_EDGE = 1920;
/** A clip is at least this long, so a short GIF still reads as a video. */
const MIN_SECONDS = 3;
/** And at most this long: recording happens in real time. */
const MAX_SECONDS = 20;
/** Frames kept from one GIF; past this a long GIF would hold too much memory. */
const MAX_GIF_FRAMES = 400;

/** A photo's picture over time. */
interface LiveSource {
  frame: (seconds: number) => Frame | undefined;
  /** One loop, in seconds, when it moves and the length is known. */
  loopSeconds?: number;
  start?: () => void;
  dispose: () => void;
}

/**
 * Which of a GIF's frames shows at `seconds`, given each frame's duration.
 * Loops, as the GIF does.
 */
export const frameIndexAt = (durations: number[], seconds: number): number => {
  const total = durations.reduce((sum, duration) => sum + duration, 0);
  if (total <= 0 || durations.length === 0) return 0;
  let at = seconds % total;
  for (let index = 0; index < durations.length; index++) {
    at -= durations[index]!;
    if (at < 0) return index;
  }
  return durations.length - 1;
};

interface DecodedImage {
  image: VideoFrame;
}
interface ImageDecoderLike {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null };
  decode: (options: { frameIndex: number }) => Promise<DecodedImage>;
  close: () => void;
}
type ImageDecoderCtor = new (init: {
  data: ReadableStream<Uint8Array> | BufferSource;
  type: string;
}) => ImageDecoderLike;

/**
 * A GIF's frames, decoded ahead with WebCodecs where the browser has it. A
 * canvas draws only the first frame of a GIF image, so drawing the <img> would
 * record a still.
 */
const decodeGif = async (src: string): Promise<LiveSource | null> => {
  const Decoder = (globalThis as { ImageDecoder?: ImageDecoderCtor }).ImageDecoder;
  if (!Decoder) return null;
  const response = await fetch(src, { mode: 'cors' });
  if (!response.ok) throw new Error('Failed to load GIF for export');
  const decoder = new Decoder({ data: await response.arrayBuffer(), type: 'image/gif' });
  await decoder.tracks.ready;
  const count = Math.min(decoder.tracks.selectedTrack?.frameCount ?? 1, MAX_GIF_FRAMES);
  const frames: VideoFrame[] = [];
  for (let index = 0; index < count; index++) frames.push((await decoder.decode({ frameIndex: index })).image);
  decoder.close();
  // Durations are in microseconds; a GIF with none is shown at 10 frames a second.
  const durations = frames.map((frame) => (frame.duration ?? 100_000) / 1_000_000 || 0.1);
  return {
    loopSeconds: durations.reduce((sum, duration) => sum + duration, 0),
    frame: (seconds) => {
      const frame = frames[frameIndexAt(durations, seconds)];
      return frame ? { source: frame, width: frame.displayWidth, height: frame.displayHeight } : undefined;
    },
    dispose: () => frames.forEach((frame) => frame.close())
  };
};

const liveSource = async (resolved: ResolvedPhoto): Promise<LiveSource | undefined> => {
  const src = resolved.src || resolved.thumbSrc;
  if (!src) return undefined;
  if (isVideoType(resolved.mimetype)) {
    const video = await loadVideo(src);
    return {
      loopSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
      frame: () => videoFrame(video),
      start: () => {
        video.currentTime = 0;
        void video.play().catch(() => undefined);
      },
      dispose: () => {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    };
  }
  if (resolved.mimetype === 'image/gif') {
    try {
      const gif = await decodeGif(src);
      if (gif) return gif;
    } catch {
      // fall back to the still below
    }
  }
  // A still, and a GIF where it cannot be decoded: a canvas draws a GIF
  // image's first frame only, whatever the page shows.
  const frame = imageFrame(await loadImage(src));
  return { frame: () => frame, dispose: () => undefined };
};

export interface VideoExport {
  blob: Blob;
  extension: string;
}

/**
 * Records the collage as a video, with GIFs and videos playing. Takes as long
 * as the clip itself: the canvas is redrawn every frame and recorded as it
 * goes. Videos play silently, as they do on the collage.
 */
export const exportCollageToVideo = async (
  doc: CollageDoc,
  resolvePhoto: ResolvePhoto,
  onProgress?: (fraction: number) => void
): Promise<VideoExport> => {
  const format = pickVideoFormat();
  if (!format) throw new Error('This browser cannot record video. Try Chrome, Edge, Firefox or Safari.');

  const scale = Math.min(EXPORT_SCALE, VIDEO_LONG_EDGE / Math.max(doc.canvas.width, doc.canvas.height));
  const { canvas, ctx } = newCanvas(doc, scale);
  if (typeof canvas.captureStream !== 'function') throw new Error('This browser cannot record video.');

  const sources = new Map<string, LiveSource>();
  try {
    await Promise.all([
      loadFontsFor(doc.texts),
      ...doc.photos.map(async (photo) => {
        const resolved = resolvePhoto(photo.photoId);
        if (!resolved) return;
        try {
          const source = await liveSource(resolved);
          if (source) sources.set(photo.id, source);
        } catch {
          // left out, as in the PNG
        }
      })
    ]);

    const loops = [...sources.values()].map((source) => source.loopSeconds ?? 0);
    const seconds = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, ...loops));

    // Drawn once before recording, so a tainted canvas fails here and not mid-clip.
    renderScene(ctx, doc, (photo) => sources.get(photo.id)?.frame(0));
    let stream: MediaStream;
    try {
      stream = canvas.captureStream(FPS);
    } catch {
      throw new Error(CORS_MESSAGE);
    }

    const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('Recording the video failed'));
    });

    sources.forEach((source) => source.start?.());
    recorder.start(250);
    const startedAt = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = (performance.now() - startedAt) / 1000;
        renderScene(ctx, doc, (photo) => sources.get(photo.id)?.frame(elapsed));
        onProgress?.(Math.min(1, elapsed / seconds));
        if (elapsed >= seconds) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    return { blob: new Blob(chunks, { type: format.mimeType.split(';')[0] }), extension: format.extension };
  } finally {
    sources.forEach((source) => source.dispose());
  }
};

export { downloadBlob } from '@tumbaland/frontend-core';
