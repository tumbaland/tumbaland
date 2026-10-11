import { CollageConfig, CollageConfigPhoto, CollageTextBox } from './config';

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

export type TextAlign = 'left' | 'center' | 'right';

/** The shapes "Add element" offers. Drawn from the paths in collageElements. */
export const COLLAGE_SHAPES = ['rectangle', 'rounded', 'circle', 'heart', 'star', 'triangle', 'arrow'] as const;
export type CollageShape = (typeof COLLAGE_SHAPES)[number];

/**
 * Everything drawn over the photos: text, stickers and shapes. They share one
 * layer (stored as `texts`, the name it had when text was all there was), so
 * they stack among each other and always sit above the photos.
 *
 * - text: `text` in the chosen font and style.
 * - sticker: an emoji in `text`, sized to fill its box rather than by `fontSize`.
 * - shape: `shape` filled with `color`; `text` is unused.
 *
 * Optional style fields are left out when they are the default, so a text
 * made before they existed reads exactly as it did.
 */
export interface CollageTextItem {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  /** Absent means text. */
  kind?: 'sticker' | 'shape';
  shape?: CollageShape;
  /** A font id from collageElements; absent is the plain sans. */
  fontFamily?: string;
  /** Absent means bold: every text was bold before this could be changed. */
  bold?: boolean;
  italic?: boolean;
  /** Absent means centred. */
  align?: TextAlign;
  /** A colour band behind the text, or a shape's outline colour. */
  background?: string;
  /** Stroke round the letters, or round a shape. */
  outline?: string;
  shadow?: boolean;
  rotation?: number;
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
/** The font a text has when it names none: the app's own sans. */
export const DEFAULT_FONT = 'sans';

/** What "Add text" puts on the canvas, selected in the text dialog so typing replaces it. */
export const DEFAULT_TEXT = 'Your text';

export const isVideoType = (mimetype?: string): boolean => Boolean(mimetype?.startsWith('video/'));
/** Animated as far as a collage is concerned: a video, or a GIF, which may or may not move. */
export const isMovingType = (mimetype?: string): boolean => isVideoType(mimetype) || mimetype === 'image/gif';

/** Web Crypto, which browsers and Node both put on globalThis; typed here because this lib has no DOM. */
const webCrypto = () => (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

export const newItemId = (): string =>
  webCrypto()?.randomUUID
    ? webCrypto()!.randomUUID!()
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
export const isQuarterTurned = (orientation?: number | null): boolean => orientationTurns(orientation) % 2 === 1;

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

/** One stored photo, as the editor holds it. Accepts v1 and v2 shapes. */
export const normalizePhoto = (p: CollageConfigPhoto): CollagePhotoItem => {
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
};

const isShape = (value: unknown): value is CollageShape =>
  (COLLAGE_SHAPES as readonly string[]).includes(value as string);
const isAlign = (value: unknown): value is TextAlign => value === 'left' || value === 'center' || value === 'right';
const nonEmpty = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);

/**
 * The optional style fields, keeping only the ones that differ from the
 * default. A default written out would read as a change to every text made
 * before the field existed.
 */
const textStyle = (t: CollageTextBox | CollageTextItem): Partial<CollageTextItem> => {
  const style: Partial<CollageTextItem> = {};
  if (t.kind === 'shape' && isShape(t.shape)) {
    style.kind = 'shape';
    style.shape = t.shape;
  } else if (t.kind === 'sticker') {
    style.kind = 'sticker';
  }
  const fontFamily = nonEmpty(t.fontFamily);
  if (fontFamily && fontFamily !== DEFAULT_FONT) style.fontFamily = fontFamily;
  if (t.bold === false) style.bold = false;
  if (t.italic === true) style.italic = true;
  if (isAlign(t.align) && t.align !== 'center') style.align = t.align;
  const background = nonEmpty(t.background);
  if (background) style.background = background;
  const outline = nonEmpty(t.outline);
  if (outline) style.outline = outline;
  if (t.shadow === true) style.shadow = true;
  const rotation = toNumber(t.rotation, 0);
  if (rotation) style.rotation = rotation;
  return style;
};

/**
 * A change to an overlay item, with every default written as undefined, so
 * the edited item stays in the shape normalizeText gives it. Otherwise
 * `bold: true` here and no `bold` in the saved copy would compare as a
 * difference forever, and autosave would keep sending it.
 */
export const cleanTextPatch = <T extends Partial<CollageTextItem>>(patch: T): T => {
  const out: Partial<CollageTextItem> = { ...patch };
  if ('fontFamily' in out && (!out.fontFamily || out.fontFamily === DEFAULT_FONT)) out.fontFamily = undefined;
  if ('bold' in out && out.bold !== false) out.bold = undefined;
  if ('italic' in out && out.italic !== true) out.italic = undefined;
  if ('align' in out && (!out.align || out.align === 'center')) out.align = undefined;
  if ('background' in out && !out.background) out.background = undefined;
  if ('outline' in out && !out.outline) out.outline = undefined;
  if ('shadow' in out && out.shadow !== true) out.shadow = undefined;
  if ('rotation' in out && !out.rotation) out.rotation = undefined;
  return out as T;
};

export const normalizeText = (t: CollageTextBox): CollageTextItem => ({
  id: typeof t.id === 'string' && t.id ? t.id : newItemId(),
  text: typeof t.text === 'string' ? t.text : '',
  x: toNumber(t.x, 100),
  y: toNumber(t.y, 100),
  width: toNumber(t.width, 180),
  height: toNumber(t.height, 48),
  fontSize: toNumber(t.fontSize, DEFAULT_TEXT_SIZE),
  color: typeof t.color === 'string' ? t.color : DEFAULT_TEXT_COLOR,
  ...textStyle(t)
});

export const normalizeCollageConfig = (config?: CollageConfig | null): CollageDoc => {
  const cfg: Partial<CollageConfig> = config ?? {};

  const canvas = {
    width: toNumber(cfg.viewport?.width, DEFAULT_CANVAS.width),
    height: toNumber(cfg.viewport?.height, DEFAULT_CANVAS.height)
  };

  const photos: CollagePhotoItem[] = Array.isArray(cfg.photos) ? cfg.photos.map(normalizePhoto) : [];
  const texts: CollageTextItem[] = Array.isArray(cfg.texts) ? cfg.texts.map(normalizeText) : [];

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

/** One photo as it is stored. Legacy keys are written too, for older readers. */
export const serializePhoto = (p: CollagePhotoItem, frameEnabled: boolean): CollageConfigPhoto => ({
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
  frameVisible: p.frame ?? frameEnabled,
  transparentBackground: p.frame === undefined ? undefined : !p.frame
});

export const serializeText = (t: CollageTextItem): CollageTextBox => ({
  id: t.id,
  text: t.text,
  x: t.x,
  y: t.y,
  width: t.width,
  height: t.height,
  fontSize: t.fontSize,
  color: t.color,
  ...textStyle(t)
});

/** The collage-wide settings, under the config keys they are stored as. */
export const serializeSettings = (doc: Pick<CollageDoc, 'canvas' | 'background' | 'frameColor' | 'frameEnabled'>) => ({
  viewport: { width: doc.canvas.width, height: doc.canvas.height },
  backgroundColor: doc.background,
  borderColor: doc.frameColor,
  photoTransparencyMode: !doc.frameEnabled
});

export const serializeCollageDoc = (doc: CollageDoc, existingConfig?: CollageConfig | null): CollageConfig => {
  return {
    ...(existingConfig ?? {}),
    version: '2.0',
    date: existingConfig?.date ?? new Date().toISOString(),
    theme: existingConfig?.theme ?? 'default',
    ...serializeSettings(doc),
    photos: doc.photos.map((p) => serializePhoto(p, doc.frameEnabled)),
    texts: doc.texts.map(serializeText)
  } as CollageConfig;
};

/** Effective frame state for a photo, honoring the per-photo override. */
export const photoHasFrame = (doc: CollageDoc, photo: CollagePhotoItem): boolean => photo.frame ?? doc.frameEnabled;

/**
 * Short names for a collage's items, in stacking order: `p1`, `p2`… for photos
 * and `t1`, `t2`… for texts, stickers and shapes. What an assistant reads in a
 * description and sees drawn on a preview, so it can say "move p3" about
 * something it saw. They follow the order, so a removal renumbers what is
 * after it; a description is always read fresh before the next change.
 */
export const shortIdsOf = (doc: Pick<CollageDoc, 'photos' | 'texts'>): Map<string, string> =>
  new Map([
    ...doc.photos.map((photo, index) => [photo.id, `p${index + 1}`] as const),
    ...doc.texts.map((item, index) => [item.id, `t${index + 1}`] as const)
  ]);
