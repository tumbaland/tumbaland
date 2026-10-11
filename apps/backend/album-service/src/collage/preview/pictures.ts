import sharp from 'sharp';
import { Image, loadImage } from '@napi-rs/canvas';
import { logger } from '@tumbaland/backend-core';
import { getFile } from '../../services/fileServiceClient';

/**
 * The pictures a preview or a contact sheet is drawn from, decoded.
 *
 * Thumbnails, not originals: a preview is for looking at, it has to be quick
 * on the Pi, and at preview size a 300 pixel thumbnail is as much as a photo
 * box shows. An original is fetched only for an image that has no thumbnail.
 */

/** The fields of a photo this needs. */
export interface PicturedPhoto {
  _id: unknown;
  mimetype: string;
  minioFileId?: string;
  minioThumbnailFileId?: string;
  minioPosterFileId?: string;
  width?: number;
  height?: number;
  metadata?: { exif?: Record<string, unknown> };
  /** Set on photos that came from a chat. */
  source?: { kind?: string } | null;
}

/** What Skia decodes. Anything else (HEIC, a video file) is left as a grey box. */
const DRAWABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** How many files are fetched at once, so a big album does not open a hundred requests. */
const CONCURRENCY = 6;

/** The longest side an original is shrunk to before it is drawn. */
const ORIGINAL_LONG_EDGE = 600;

type Source = { fileId: string; kind: 'thumbnail' | 'original' };

const sourceOf = (photo: PicturedPhoto): Source | undefined => {
  if (photo.mimetype.startsWith('video/')) {
    return photo.minioPosterFileId ? { fileId: photo.minioPosterFileId, kind: 'thumbnail' } : undefined;
  }
  if (photo.minioThumbnailFileId) return { fileId: photo.minioThumbnailFileId, kind: 'thumbnail' };
  if (photo.minioFileId && DRAWABLE.has(photo.mimetype)) return { fileId: photo.minioFileId, kind: 'original' };
  return undefined;
};

/**
 * The EXIF orientation a thumbnail still has to be turned by, if any.
 *
 * It depends on who made the thumbnail. Album's own are resized without being
 * turned (and their EXIF is dropped), so a phone photo stored on its side has a
 * thumbnail on its side. Chat makes its thumbnails with `rotate()`, which has
 * already applied it. Photos that came from a chat say so in `source`, so that
 * is what decides, not the picture's shape: shape cannot tell an upside-down
 * thumbnail from an upright one.
 *
 * The editor shows the original, which the browser turns by its EXIF, so
 * turning the thumbnail by the same number is what makes a preview match it.
 */
export const pendingOrientation = (
  photo: Pick<PicturedPhoto, 'source' | 'metadata'>
): 2 | 3 | 4 | 5 | 6 | 7 | 8 | undefined => {
  if (photo.source?.kind === 'chat') return undefined;
  const orientation = Number(photo.metadata?.exif?.orientation);
  return Number.isInteger(orientation) && orientation >= 2 && orientation <= 8
    ? (orientation as 2 | 3 | 4 | 5 | 6 | 7 | 8)
    : undefined;
};

const decode = async (photo: PicturedPhoto, source: Source): Promise<Image> => {
  const bytes = await getFile(source.fileId);
  if (source.kind === 'original') {
    // rotate() with no angle applies the file's own EXIF orientation.
    const small = await sharp(bytes)
      .rotate()
      .resize(ORIGINAL_LONG_EDGE, ORIGINAL_LONG_EDGE, { fit: 'inside', withoutEnlargement: true })
      .jpeg()
      .toBuffer();
    return loadImage(small);
  }

  const orientation = pendingOrientation(photo);
  if (!orientation) return loadImage(bytes);

  // The thumbnail has no EXIF of its own left to read, so the number is put
  // back on it and sharp's own auto-orient does the turning, mirrored cases
  // included, rather than a second table of them here.
  const tagged = await sharp(bytes).withMetadata({ orientation }).jpeg().toBuffer();
  return loadImage(await sharp(tagged).rotate().jpeg().toBuffer());
};

/**
 * Each photo's picture, by photo id. A photo whose file is missing or will not
 * decode is left out, and draws as a grey box: one bad file should not cost
 * the whole preview.
 */
export const loadPictures = async (photos: PicturedPhoto[]): Promise<Map<string, Image>> => {
  const pictures = new Map<string, Image>();
  const queue = photos.slice();

  const worker = async () => {
    for (let photo = queue.shift(); photo; photo = queue.shift()) {
      const source = sourceOf(photo);
      if (!source) continue;
      try {
        pictures.set(String(photo._id), await decode(photo, source));
      } catch (error) {
        logger.warn('Could not load a picture for a preview', {
          photoId: String(photo._id),
          error: (error as Error)?.message
        });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return pictures;
};

/** The fields loadPictures reads, for a query's select. */
export const PICTURE_FIELDS =
  'mimetype minioFileId minioThumbnailFileId minioPosterFileId width height metadata.exif.orientation source.kind';
