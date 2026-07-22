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

export interface CollagePhotoItem {
  id: string;
  photoId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  caption: string;
  /** undefined = inherit the document-level frameEnabled setting */
  frame?: boolean;
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
export const DEFAULT_BACKGROUND = '#111111';
export const DEFAULT_FRAME_COLOR = '#ffffff';
export const DEFAULT_TEXT_COLOR = '#e91e63';
export const DEFAULT_TEXT_SIZE = 32;

export const newItemId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? parseFloat(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};

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
          caption: typeof p.caption === 'string' ? p.caption : '',
          frame
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
