import { CollageConfig } from '../../types/collage';

/**
 * Normalized, editor-friendly representation of a collage.
 *
 * Stored configs come in two flavors:
 *  - v1 (legacy): photos with { position: { left, top }, frameVisible,
 *    transparentBackground }, texts without styling, plus top-level
 *    backgroundColor / borderColor / photoTransparencyMode.
 *  - v2 (written by this editor): same top-level keys kept for backward
 *    compatibility, plus flat x/y and explicit style fields per item.
 *
 * normalizeCollageConfig() accepts both; serializeCollageDoc() writes v2
 * while preserving every v1 key so older data (and unknown keys such as
 * textSections) survive a round-trip.
 */

/**
 * Region of the image to show, as fractions (0..1) of its natural size.
 * Absent means the whole image. Kept resolution-independent so the same crop
 * works for the thumbnail on the canvas and the full-size original on export.
 *
 * Measured against the *oriented* image, i.e. after the item's `orientation`
 * quarter turns are applied — that is the picture the user drew the crop on.
 * Renderers undo those turns with sourceCrop() before touching the file.
 */
export interface CollageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollagePhotoItem {
  id: string;
  photoId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /**
   * Quarter turns baked into the picture, in degrees (0/90/180/270). Fixes a
   * photo that was shot or uploaded sideways; unlike `rotation` it turns the
   * image inside its box rather than tilting the box on the canvas.
   */
  orientation?: number;
  caption: string;
  /** undefined = inherit the document-level frameEnabled setting */
  frame?: boolean;
  /** undefined = show the whole image */
  crop?: CollageCrop;
}

export interface CollageTextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
}

export interface CollageDoc {
  canvas: { width: number; height: number };
  background: string;
  frameEnabled: boolean;
  frameColor: string;
  photos: CollagePhotoItem[];
  texts: CollageTextItem[];
}

export const DEFAULT_CANVAS = { width: 1600, height: 900 };
export const DEFAULT_BACKGROUND = '#f1f5f9';
export const DEFAULT_FRAME_COLOR = '#ffffff';
export const DEFAULT_TEXT_COLOR = '#e91e63';
/**
 * Surface behind the canvas in the editor and the viewer. Deliberately not
 * black: an empty or still-loading collage on a black backdrop is
 * indistinguishable from a blank page.
 */
export const EDITOR_BACKDROP = '#1e293b';
export const DEFAULT_TEXT_SIZE = 32;

export const newItemId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

/** Smallest crop the UI will produce, as a fraction of the source image. */
export const MIN_CROP_SIZE = 0.05;

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Read a stored crop, keeping it only when it is a real sub-region: malformed
 * values and full-image crops both collapse to undefined so the rest of the
 * code has a single "no crop" case to handle.
 */
export const normalizeCrop = (value?: Partial<CollageCrop> | null): CollageCrop | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  const x = clamp01(toNumber(value.x, 0));
  const y = clamp01(toNumber(value.y, 0));
  // a missing or unreadable size falls through the MIN_CROP_SIZE guard below
  // rather than defaulting to "as much as fits", which would invent a crop
  const width = Math.min(clamp01(toNumber(value.width, 0)), 1 - x);
  const height = Math.min(clamp01(toNumber(value.height, 0)), 1 - y);

  if (width < MIN_CROP_SIZE || height < MIN_CROP_SIZE) return undefined;
  if (x === 0 && y === 0 && width === 1 && height === 1) return undefined;

  return { x, y, width, height };
};

/** Quarter turns (0-3, clockwise) an orientation in degrees stands for. */
export const orientationTurns = (orientation?: number | null): number => {
  const degrees = toNumber(orientation, 0);
  return ((Math.round(degrees / 90) % 4) + 4) % 4;
};

/** True when the orientation swaps the image's width and height. */
export const isQuarterTurned = (orientation?: number | null): boolean =>
  orientationTurns(orientation) % 2 === 1;

/** Stored orientation, snapped to a quarter turn; upright collapses to undefined. */
export const normalizeOrientation = (value?: number | null): number | undefined => {
  const turns = orientationTurns(value);
  return turns === 0 ? undefined : turns * 90;
};

/**
 * The same region of a picture, re-expressed after the picture itself is
 * turned `turns` quarter turns clockwise. Used both to keep a crop pinned to
 * what it framed while the user rotates, and to undo the turns for renderers.
 */
export const rotateCropClockwise = (crop: CollageCrop | undefined, turns: number): CollageCrop | undefined => {
  if (!crop) return undefined;
  let out = crop;
  for (let step = ((Math.round(turns) % 4) + 4) % 4; step > 0; step -= 1) {
    out = { x: 1 - out.y - out.height, y: out.x, width: out.height, height: out.width };
  }
  return out;
};

/**
 * A photo's crop expressed against the untouched source file, which is what
 * every renderer ultimately samples from.
 */
export const sourceCrop = (photo: Pick<CollagePhotoItem, 'crop' | 'orientation'>): CollageCrop | undefined =>
  rotateCropClockwise(photo.crop, -orientationTurns(photo.orientation));

export const normalizeCollageConfig = (config?: CollageConfig | null): CollageDoc => {
  const cfg: Partial<CollageConfig> = config ?? {};

  const canvas = {
    width: toNumber(cfg.viewport?.width, DEFAULT_CANVAS.width),
    height: toNumber(cfg.viewport?.height, DEFAULT_CANVAS.height)
  };

  const photos: CollagePhotoItem[] = Array.isArray(cfg.photos)
    ? cfg.photos.map((p): CollagePhotoItem => {
        // v1 kept the photo id in `photoId`, some very old configs only in `filename`
        const photoId = p.photoId || p.filename || '';
        // v1 stored transparency, not frames: transparent === no frame
        let frame: boolean | undefined;
        if (typeof p.frame === 'boolean') frame = p.frame;
        else if (typeof p.transparentBackground === 'boolean') frame = !p.transparentBackground;
        return {
          id: typeof p.id === 'string' && p.id ? p.id : newItemId(),
          photoId,
          x: toNumber(p.x ?? p.position?.left, 100),
          y: toNumber(p.y ?? p.position?.top, 100),
          width: toNumber(p.width, 120),
          height: toNumber(p.height, 120),
          rotation: toNumber(p.rotation, 0),
          orientation: normalizeOrientation(p.orientation),
          caption: typeof p.caption === 'string' ? p.caption : '',
          frame,
          crop: normalizeCrop(p.crop)
        };
      })
    : [];

  const texts: CollageTextItem[] = Array.isArray(cfg.texts)
    ? cfg.texts.map((t): CollageTextItem => ({
        id: typeof t.id === 'string' && t.id ? t.id : newItemId(),
        text: typeof t.text === 'string' ? t.text : '',
        x: toNumber(t.x, 100),
        y: toNumber(t.y, 100),
        width: toNumber(t.width, 180),
        height: toNumber(t.height, 48),
        fontSize: toNumber(t.fontSize, DEFAULT_TEXT_SIZE),
        color: typeof t.color === 'string' ? t.color : DEFAULT_TEXT_COLOR
      }))
    : [];

  return {
    canvas,
    background: typeof cfg.backgroundColor === 'string' ? cfg.backgroundColor : DEFAULT_BACKGROUND,
    // v1 default was photoTransparencyMode=true, i.e. frames off
    frameEnabled: cfg.photoTransparencyMode !== undefined ? !cfg.photoTransparencyMode : false,
    frameColor: typeof cfg.borderColor === 'string' ? cfg.borderColor : DEFAULT_FRAME_COLOR,
    photos,
    texts
  };
};

export const serializeCollageDoc = (doc: CollageDoc, existingConfig?: CollageConfig | null): CollageConfig => {
  return {
    ...(existingConfig ?? {}),
    version: '2.0',
    date: existingConfig?.date ?? new Date().toISOString(),
    theme: existingConfig?.theme ?? 'default',
    viewport: { width: doc.canvas.width, height: doc.canvas.height },
    backgroundColor: doc.background,
    borderColor: doc.frameColor,
    photoTransparencyMode: !doc.frameEnabled,
    photos: doc.photos.map((p) => ({
      id: p.id,
      photoId: p.photoId,
      filename: p.photoId, // legacy readers used filename as the photo reference
      caption: p.caption,
      x: p.x,
      y: p.y,
      position: { left: p.x, top: p.y },
      width: p.width,
      height: p.height,
      rotation: p.rotation,
      orientation: p.orientation,
      crop: p.crop,
      frame: p.frame,
      frameVisible: p.frame ?? doc.frameEnabled,
      transparentBackground: p.frame === undefined ? undefined : !p.frame
    })),
    texts: doc.texts.map((t) => ({
      id: t.id,
      text: t.text,
      x: t.x,
      y: t.y,
      width: t.width,
      height: t.height,
      fontSize: t.fontSize,
      color: t.color
    }))
  } as CollageConfig;
};

/** Effective frame state for a photo, honoring the per-photo override. */
export const photoHasFrame = (doc: CollageDoc, photo: CollagePhotoItem): boolean =>
  photo.frame ?? doc.frameEnabled;
