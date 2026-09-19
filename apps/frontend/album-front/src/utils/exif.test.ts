import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('exifr/dist/lite.esm.mjs', () => ({ default: { parse: vi.fn() } }));

import exifr from 'exifr/dist/lite.esm.mjs';
import { exifDateToUtc, toDecimalDegrees, metadataFromExif, extractPhotoMetadata } from './exif';

const mockedParse = exifr.parse as unknown as ReturnType<typeof vi.fn>;

const imageFile = (name = 'photo.jpg', type = 'image/jpeg') => new File([new Uint8Array([1, 2, 3])], name, { type });

beforeEach(() => vi.clearAllMocks());

describe('exifDateToUtc', () => {
  it('reads a naive EXIF timestamp as the wall-clock reading it is', () => {
    // Not 11:24Z: the reading must survive whatever timezone the browser is in,
    // or a photo taken near midnight lands on the wrong day.
    expect(exifDateToUtc('2024:11:16 13:24:20')?.toISOString()).toBe('2024-11-16T13:24:20.000Z');
  });

  it('accepts the ISO-ish separator some files use', () => {
    expect(exifDateToUtc('2024:11:16T13:24:20')?.toISOString()).toBe('2024-11-16T13:24:20.000Z');
  });

  it.each([
    ['a zeroed clock', '0000:00:00 00:00:00'],
    ['a year out of range', '1000:01:01 00:00:00'],
    ['an unparseable string', 'yesterday'],
    ['a non-string', 12345]
  ])('returns null for %s', (_label, raw) => {
    expect(exifDateToUtc(raw)).toBeNull();
  });
});

describe('toDecimalDegrees', () => {
  it('converts degrees/minutes/seconds to decimal', () => {
    expect(toDecimalDegrees([58, 22, 35.89], 'N')).toBeCloseTo(58.3766361, 6);
  });

  it.each([['S'], ['W']])('makes a %s reference negative', (ref) => {
    expect(toDecimalDegrees([58, 22, 35.89], ref)).toBeCloseTo(-58.3766361, 6);
  });

  it('treats a missing seconds component as zero', () => {
    expect(toDecimalDegrees([10, 30], 'E')).toBeCloseTo(10.5, 6);
  });

  it.each([
    ['a non-array', 58.37],
    ['too few parts', [58]],
    ['non-numeric parts', ['a', 'b', 'c']]
  ])('returns null for %s', (_label, dms) => {
    expect(toDecimalDegrees(dms, 'N')).toBeNull();
  });
});

describe('metadataFromExif', () => {
  const full = {
    DateTimeOriginal: '2024:11:16 13:24:20',
    OffsetTimeOriginal: '+02:00',
    Make: 'Google',
    Model: 'Pixel 8a',
    ISO: 182,
    FNumber: 1.89,
    ExposureTime: 0.005,
    FocalLength: 5.43,
    Orientation: 1,
    GPSLatitude: [58, 22, 35.89],
    GPSLatitudeRef: 'N',
    GPSLongitude: [26, 44, 2.98],
    GPSLongitudeRef: 'E'
  };

  it('returns undefined when there is no EXIF at all', () => {
    expect(metadataFromExif(null)).toBeUndefined();
    expect(metadataFromExif({})).toBeUndefined();
  });

  it('maps the fields the app reads today', () => {
    const metadata = metadataFromExif(full);

    expect(metadata?.dateTaken).toBe('2024-11-16T13:24:20.000Z');
    expect(metadata?.camera).toMatchObject({
      make: 'Google',
      model: 'Pixel 8a',
      settings: { iso: 182, aperture: 'f/1.89', focalLength: '5.43mm', shutterSpeed: '1/200' }
    });
    expect(metadata?.location?.latitude).toBeCloseTo(58.3766361, 6);
    expect(metadata?.location?.longitude).toBeCloseTo(26.7341611, 6);
  });

  it('keeps the timezone offset, the only record of how dateTaken should be read', () => {
    expect(metadataFromExif(full)?.exif).toMatchObject({ dateTakenOffset: '+02:00', orientation: 1 });
  });

  it('renders a slow shutter as seconds rather than a fraction', () => {
    expect(metadataFromExif({ ExposureTime: 2 })?.camera?.settings?.shutterSpeed).toBe('2s');
  });

  it('falls back through CreateDate and ModifyDate when the original is absent', () => {
    expect(metadataFromExif({ CreateDate: '2023:05:04 10:00:00' })?.dateTaken).toBe('2023-05-04T10:00:00.000Z');
    expect(metadataFromExif({ ModifyDate: '2022:05:04 10:00:00' })?.dateTaken).toBe('2022-05-04T10:00:00.000Z');
  });

  it('omits location entirely when only one coordinate is present', () => {
    expect(metadataFromExif({ GPSLatitude: [58, 22, 0], GPSLatitudeRef: 'N' })?.location).toBeUndefined();
  });

  it('still returns the camera for a file carrying no date', () => {
    const metadata = metadataFromExif({ Make: 'Canon' });
    expect(metadata?.dateTaken).toBeUndefined();
    expect(metadata?.camera?.make).toBe('Canon');
  });

  it('drops blank strings rather than storing them', () => {
    expect(metadataFromExif({ Make: '   ', Model: 'Pixel  ' })?.camera).toEqual({ model: 'Pixel' });
  });
});

describe('extractPhotoMetadata', () => {
  it('does not try to parse a non-image', async () => {
    const video = new File([new Uint8Array([1])], 'clip.mp4', { type: 'video/mp4' });
    await expect(extractPhotoMetadata(video)).resolves.toBeUndefined();
    expect(mockedParse).not.toHaveBeenCalled();
  });

  it('asks only for the tags it maps, untranslated and unrevived', async () => {
    mockedParse.mockResolvedValue({ Make: 'Google' });
    await extractPhotoMetadata(imageFile());

    const [, options] = mockedParse.mock.calls[0];
    expect(options).toMatchObject({ reviveValues: false, translateValues: false });
    expect(options.pick).toContain('DateTimeOriginal');
    expect(options.pick).toContain('OffsetTimeOriginal');
  });

  it('returns the mapped metadata', async () => {
    mockedParse.mockResolvedValue({ DateTimeOriginal: '2024:11:16 13:24:20' });
    await expect(extractPhotoMetadata(imageFile())).resolves.toMatchObject({
      dateTaken: '2024-11-16T13:24:20.000Z'
    });
  });

  it('never fails an upload over unreadable metadata', async () => {
    mockedParse.mockRejectedValue(new Error('corrupt header'));
    await expect(extractPhotoMetadata(imageFile())).resolves.toBeUndefined();
  });

  it('returns undefined for an image with no EXIF, such as a screenshot', async () => {
    mockedParse.mockResolvedValue(undefined);
    await expect(extractPhotoMetadata(imageFile('shot.png', 'image/png'))).resolves.toBeUndefined();
  });
});
