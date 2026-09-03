// exifr's `lite` build carries TIFF/EXIF/GPS — everything below — at roughly
// two thirds the size of the full build, which also parses formats (HEIC, ICC,
// IPTC) no upload path here reads.
import exifr from 'exifr/dist/lite.esm.mjs';
import { logger } from '@tumbaland/frontend-core';
import type { PhotoMetadata } from '../types';

/**
 * The tags worth keeping. The first groups fill `dateTaken`, `camera` and
 * `location`, which the app reads today; the rest lands in `metadata.exif`
 * against features that do not exist yet. Reading them costs nothing extra —
 * they are all in the same header block already being parsed.
 *
 * This is the only extractor now: a one-off script backfilled the photos that
 * predate it, straight from the originals on disk, and was deleted once it had
 * run. scripts/download-photo-originals.js still pulls the library down locally
 * if that ever needs doing again.
 */
const TAGS = [
  'DateTimeOriginal', 'CreateDate', 'ModifyDate',
  'OffsetTimeOriginal', 'OffsetTime',
  'Make', 'Model', 'LensMake', 'LensModel', 'Software',
  'ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'FocalLengthIn35mmFormat',
  'ExposureProgram', 'ExposureMode', 'ExposureCompensation', 'MeteringMode',
  'WhiteBalance', 'Flash', 'SceneCaptureType', 'DigitalZoomRatio',
  'SubjectDistance', 'ColorSpace', 'Orientation',
  'ExifImageWidth', 'ExifImageHeight',
  'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef',
  'GPSAltitude', 'GPSDateStamp',
  'Artist', 'Copyright'
];

type RawExif = Record<string, unknown>;

/**
 * An EXIF timestamp is a naive wall-clock reading — "2024:11:16 13:24:20" with
 * no zone attached. Building the instant with Date.UTC preserves that reading,
 * so the UTC calendar date matches the day the photographer experienced.
 * Reviving it as a local time instead would shift a photo taken near midnight
 * onto the wrong day, which is exactly what an "on this day" feature must not
 * get wrong. The original zone is kept separately as `exif.dateTakenOffset`.
 */
export const exifDateToUtc = (raw: unknown): Date | null => {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  // A camera with a flat clock battery writes zeroes; that is not a date.
  if (!year || year < 1900 || year > 2100 || !month || !day) return null;

  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
};

/** GPS as [degrees, minutes, seconds] plus an N/S/E/W ref → signed decimal. */
export const toDecimalDegrees = (dms: unknown, ref: unknown): number | null => {
  if (!Array.isArray(dms) || dms.length < 2) return null;
  const [degrees, minutes, seconds = 0] = dms.map(Number);
  if ([degrees, minutes, seconds].some((n) => !Number.isFinite(n))) return null;

  const magnitude = Math.abs(degrees) + minutes / 60 + seconds / 3600;
  const negative = ref === 'S' || ref === 'W';
  return Number((negative ? -magnitude : magnitude).toFixed(7));
};

const asNumber = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const asText = (value: unknown): string | undefined => {
  const text = String(value).trim().replace(/\0+$/, '');
  return text.length > 0 ? text.slice(0, 200) : undefined;
};

/** Assign only when the tag holds something usable, keeping the object sparse. */
function put<T>(target: Record<string, unknown>, key: string, value: unknown, map: (v: unknown) => T | undefined): void {
  if (value === undefined || value === null || value === '') return;
  const mapped = map(value);
  if (mapped !== undefined) target[key] = mapped;
}

/** Shape raw EXIF into the `metadata` the album service stores. */
export const metadataFromExif = (exif: RawExif | null): PhotoMetadata | undefined => {
  if (!exif) return undefined;
  const metadata: PhotoMetadata = {};

  // DateTimeOriginal is when the shutter fired; the rest are fallbacks for files
  // carrying only a digitised or modified stamp.
  const dateTaken =
    exifDateToUtc(exif.DateTimeOriginal) ||
    exifDateToUtc(exif.CreateDate) ||
    exifDateToUtc(exif.ModifyDate);
  if (dateTaken) metadata.dateTaken = dateTaken.toISOString();

  const camera: Record<string, unknown> = {};
  put(camera, 'make', exif.Make, asText);
  put(camera, 'model', exif.Model, asText);

  const settings: Record<string, unknown> = {};
  put(settings, 'iso', exif.ISO, asNumber);
  put(settings, 'aperture', exif.FNumber, (v) => {
    const n = asNumber(v);
    return n === undefined ? undefined : `f/${n}`;
  });
  put(settings, 'focalLength', exif.FocalLength, (v) => {
    const n = asNumber(v);
    return n === undefined ? undefined : `${n}mm`;
  });
  put(settings, 'shutterSpeed', exif.ExposureTime, (v) => {
    const n = asNumber(v);
    if (n === undefined || n <= 0) return undefined;
    return n < 1 ? `1/${Math.round(1 / n)}` : `${n}s`;
  });
  if (Object.keys(settings).length > 0) camera.settings = settings;
  if (Object.keys(camera).length > 0) metadata.camera = camera as PhotoMetadata['camera'];

  const latitude = toDecimalDegrees(exif.GPSLatitude, exif.GPSLatitudeRef);
  const longitude = toDecimalDegrees(exif.GPSLongitude, exif.GPSLongitudeRef);
  if (latitude !== null && longitude !== null) {
    metadata.location = { latitude, longitude };
  }

  // Everything else, kept whole for later. `dateTakenOffset` earns its place
  // immediately: `dateTaken` is a naive reading, and this is the only record of
  // which zone it was taken in — without it the true instant is unrecoverable.
  const extra: Record<string, unknown> = {};
  put(extra, 'dateTakenOffset', exif.OffsetTimeOriginal ?? exif.OffsetTime, asText);
  put(extra, 'orientation', exif.Orientation, asNumber);
  put(extra, 'lensMake', exif.LensMake, asText);
  put(extra, 'lensModel', exif.LensModel, asText);
  put(extra, 'software', exif.Software, asText);
  put(extra, 'exposureProgram', exif.ExposureProgram, asNumber);
  put(extra, 'exposureMode', exif.ExposureMode, asNumber);
  put(extra, 'exposureCompensation', exif.ExposureCompensation, asNumber);
  put(extra, 'meteringMode', exif.MeteringMode, asNumber);
  put(extra, 'whiteBalance', exif.WhiteBalance, asNumber);
  put(extra, 'flash', exif.Flash, asNumber);
  put(extra, 'sceneCaptureType', exif.SceneCaptureType, asNumber);
  put(extra, 'digitalZoomRatio', exif.DigitalZoomRatio, asNumber);
  put(extra, 'subjectDistance', exif.SubjectDistance, asNumber);
  put(extra, 'colorSpace', exif.ColorSpace, asNumber);
  put(extra, 'focalLengthIn35mm', exif.FocalLengthIn35mmFormat, asNumber);
  put(extra, 'pixelWidth', exif.ExifImageWidth, asNumber);
  put(extra, 'pixelHeight', exif.ExifImageHeight, asNumber);
  put(extra, 'gpsAltitude', exif.GPSAltitude, asNumber);
  put(extra, 'gpsDateStamp', exif.GPSDateStamp, asText);
  put(extra, 'artist', exif.Artist, asText);
  put(extra, 'copyright', exif.Copyright, asText);
  if (Object.keys(extra).length > 0) metadata.exif = extra;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

/**
 * Read a file's EXIF without reading the file.
 *
 * exifr seeks the header block and stops, so this touches a few tens of KB of a
 * multi-megabyte photo. Callers start it alongside the upload rather than
 * before it, so the parse overlaps the transfer and costs no wall-clock time.
 *
 * Never throws: a PNG, a screenshot, a video, or a JPEG whose EXIF was stripped
 * on its way through a messaging app simply has nothing to give, and an upload
 * must not fail over metadata it was only ever hoping for.
 */
export const extractPhotoMetadata = async (file: File): Promise<PhotoMetadata | undefined> => {
  if (!file.type.startsWith('image/')) return undefined;

  try {
    const exif = await exifr.parse(file, {
      pick: TAGS,
      // Keep timestamps as written so this module decides how to read them,
      // and enums as the numbers the spec defines rather than exifr's English
      // labels, which would not survive a locale or a library upgrade.
      reviveValues: false,
      translateValues: false
    });
    return metadataFromExif(exif as RawExif | null);
  } catch (error) {
    logger.warn('EXIF extraction failed, uploading without metadata', { error, filename: file.name });
    return undefined;
  }
};
