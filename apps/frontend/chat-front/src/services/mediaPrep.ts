/**
 * What the browser does to a file before it is uploaded.
 *
 * Two jobs, both deliberately client side:
 *
 * - **Downscaling.** A modern phone camera produces 8 to 12 MB per photo. Sent
 *   as-is, a short exchange costs a hundred megabytes of someone's storage
 *   allowance and a slow upload on mobile data, to fill a bubble a few hundred
 *   pixels wide.
 * - **Video posters.** A still frame, captured from a `<video>` onto a canvas.
 *   Done here so the service needs no ffmpeg: a 100 MB binary and a transcode
 *   queue on the Pi, for two people sending clips, is the wrong trade. The
 *   cost is that a browser which cannot decode the format produces no poster,
 *   which degrades to a plain video element.
 */

/** Longest edge kept when downscaling. Comfortably past any phone screen. */
export const MAX_IMAGE_EDGE = 2048;

/** Photos smaller than this are uploaded untouched: re-encoding would only lose quality. */
export const DOWNSCALE_THRESHOLD_BYTES = 1_000_000;

export interface PreparedFile {
  blob: Blob;
  filename: string;
  mimetype: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

/** Reads a file into an <img>, so it can be drawn to a canvas. */
function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    image.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, mimetype: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode that image'))),
      mimetype,
      quality
    );
  });
}

/**
 * Shrinks an oversized photo, keeping its aspect ratio.
 *
 * Returns the original untouched when it is already small, when the format is
 * one the canvas cannot re-encode safely (HEIC, which Safari can decode but
 * would silently flatten, and GIF, where re-encoding would drop the animation),
 * or when anything goes wrong. Uploading a large file is a worse outcome than
 * failing to send one.
 */
export async function downscaleImage(file: File): Promise<PreparedFile> {
  const asIs: PreparedFile = { blob: file, filename: file.name, mimetype: file.type };

  // An animated GIF re-encodes to a single frame, and HEIC is passed through
  // for the service to convert, which it does without losing the original.
  if (file.type === 'image/gif' || file.type === 'image/heic' || file.type === 'image/heif') return asIs;
  if (file.size < DOWNSCALE_THRESHOLD_BYTES) return asIs;

  try {
    const image = await loadImage(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));

    if (scale >= 1) {
      return { ...asIs, width: image.width, height: image.height };
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return asIs;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await toBlob(canvas, 'image/jpeg', 0.85);
    // Only accepted if it actually saved something: a small photo of a flat
    // colour can re-encode larger than it started.
    if (blob.size >= file.size) return { ...asIs, width: image.width, height: image.height };

    return {
      blob,
      filename: file.name.replace(/\.[^.]+$/, '') + '.jpg',
      mimetype: 'image/jpeg',
      width: canvas.width,
      height: canvas.height
    };
  } catch {
    return asIs;
  }
}

/** How far into a clip the poster frame is taken from. */
const POSTER_SEEK_SECONDS = 0.5;

/** Give up rather than hang on a format the browser cannot decode. */
const POSTER_TIMEOUT_MS = 5000;

export interface VideoPoster {
  blob: Blob;
  width: number;
  height: number;
  durationMs: number;
}

/**
 * Captures a still frame from a video.
 *
 * Resolves to null rather than throwing on any failure: a missing poster costs
 * a grey rectangle until the video loads, while a thrown error would stop the
 * message being sent at all.
 */
export function captureVideoPoster(file: File): Promise<VideoPoster | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    const finish = (result: VideoPoster | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), POSTER_TIMEOUT_MS);

    video.muted = true;
    // Required for iOS, which otherwise refuses to load a video without a
    // user gesture and never fires `loadeddata`.
    video.playsInline = true;
    video.preload = 'metadata';

    video.onloadeddata = () => {
      // Seeking past the first frame avoids the black frame many clips open on.
      video.currentTime = Math.min(POSTER_SEEK_SECONDS, Math.max(0, (video.duration || 1) / 2));
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        if (!canvas.width || !canvas.height) return finish(null);

        const context = canvas.getContext('2d');
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) =>
            finish(
              blob
                ? {
                    blob,
                    width: canvas.width,
                    height: canvas.height,
                    durationMs: Math.round((video.duration || 0) * 1000)
                  }
                : null
            ),
          'image/jpeg',
          0.8
        );
      } catch {
        finish(null);
      }
    };

    video.onerror = () => finish(null);
    video.src = url;
  });
}
