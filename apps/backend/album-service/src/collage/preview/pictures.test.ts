jest.mock('../../services/fileServiceClient', () => ({ getFile: jest.fn() }));

import sharp from 'sharp';
import { createCanvas, Image } from '@napi-rs/canvas';
import { getFile } from '../../services/fileServiceClient';
import { loadPictures, pendingOrientation } from './pictures';

const mockedGetFile = getFile as jest.Mock;

const jpeg = (width: number, height: number) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#336699';
  ctx.fillRect(0, 0, width, height);
  return canvas.encode('jpeg');
};

beforeEach(() => mockedGetFile.mockReset());

/** Whether the top-left pixel of a decoded picture is red or blue. */
const topLeft = (picture: Image): string => {
  const canvas = createCanvas(picture.width, picture.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(picture, 0, 0);
  const [r, , b] = ctx.getImageData(2, 2, 1, 1).data;
  return r! > b! ? 'red' : 'blue';
};

describe('pendingOrientation', () => {
  const exif = (orientation: unknown) => ({ metadata: { exif: { orientation } } });

  it('turns an album thumbnail by its photo’s EXIF orientation, all the turned and mirrored ones', () => {
    for (const orientation of [2, 3, 4, 5, 6, 7, 8]) {
      expect(pendingOrientation(exif(orientation))).toBe(orientation);
    }
  });

  it('leaves upright photos, and ones with nothing recorded or nothing sensible', () => {
    expect(pendingOrientation(exif(1))).toBeUndefined();
    expect(pendingOrientation({})).toBeUndefined();
    expect(pendingOrientation(exif('Rotate 90 CW'))).toBeUndefined();
    expect(pendingOrientation(exif(9))).toBeUndefined();
  });

  it('leaves a thumbnail chat made, which was turned when it was made', () => {
    expect(pendingOrientation({ ...exif(6), source: { kind: 'chat' } })).toBeUndefined();
  });
});

describe('loadPictures', () => {
  it('decodes thumbnails, by photo id', async () => {
    mockedGetFile.mockResolvedValue(await jpeg(300, 200));

    const pictures = await loadPictures([{ _id: 'p1', mimetype: 'image/jpeg', minioThumbnailFileId: 't1' }]);

    expect(mockedGetFile).toHaveBeenCalledWith('t1');
    expect(pictures.get('p1')).toMatchObject({ width: 300, height: 200 });
  });

  it('turns an album thumbnail by its photo’s orientation, so the preview matches the editor', async () => {
    // Left half red, right half blue, like a landscape shot with the phone on its side.
    const canvas = createCanvas(300, 200);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 150, 200);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(150, 0, 150, 200);
    mockedGetFile.mockResolvedValue(await canvas.encode('jpeg', 100));

    const pictures = await loadPictures([
      { _id: 'p1', mimetype: 'image/jpeg', minioThumbnailFileId: 't1', metadata: { exif: { orientation: 6 } } },
      { _id: 'p2', mimetype: 'image/jpeg', minioThumbnailFileId: 't1', metadata: { exif: { orientation: 3 } } },
      { _id: 'p3', mimetype: 'image/jpeg', minioThumbnailFileId: 't1', metadata: { exif: { orientation: 6 } }, source: { kind: 'chat' } }
    ]);

    // Orientation 6 is "turn a quarter clockwise": the red half ends up on top.
    expect(pictures.get('p1')).toMatchObject({ width: 200, height: 300 });
    expect(await topLeft(pictures.get('p1')!)).toEqual('red');
    // 180 degrees keeps the shape and swaps the halves.
    expect(pictures.get('p2')).toMatchObject({ width: 300, height: 200 });
    expect(await topLeft(pictures.get('p2')!)).toEqual('blue');
    // Chat's thumbnail was turned when it was made: left as it is.
    expect(pictures.get('p3')).toMatchObject({ width: 300, height: 200 });
    expect(await topLeft(pictures.get('p3')!)).toEqual('red');
  });

  it('draws a video from its poster, and skips one with none', async () => {
    mockedGetFile.mockResolvedValue(await jpeg(160, 90));

    const pictures = await loadPictures([
      { _id: 'v1', mimetype: 'video/mp4', minioPosterFileId: 'poster', minioThumbnailFileId: 'not-an-image' },
      { _id: 'v2', mimetype: 'video/mp4', minioFileId: 'video-file' }
    ]);

    expect(mockedGetFile).toHaveBeenCalledTimes(1);
    expect(mockedGetFile).toHaveBeenCalledWith('poster');
    expect([...pictures.keys()]).toEqual(['v1']);
  });

  it('shrinks an original, turned by its own EXIF, when there is no thumbnail', async () => {
    // A landscape file tagged "turn a quarter clockwise" is a portrait photo.
    const original = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#aabbcc' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    mockedGetFile.mockResolvedValue(original);

    const pictures = await loadPictures([{ _id: 'p1', mimetype: 'image/jpeg', minioFileId: 'orig' }]);

    expect(pictures.get('p1')).toMatchObject({ width: 400, height: 600 });
  });

  it('leaves out what it cannot draw, and what fails to load', async () => {
    mockedGetFile.mockRejectedValue(new Error('gone'));

    const pictures = await loadPictures([
      { _id: 'heic', mimetype: 'image/heic', minioFileId: 'orig' },
      { _id: 'lost', mimetype: 'image/jpeg', minioThumbnailFileId: 'missing' }
    ]);

    expect(mockedGetFile).toHaveBeenCalledTimes(1);
    expect(pictures.size).toBe(0);
  });
});
