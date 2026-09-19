const mockSharpInstance = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(),
  metadata: jest.fn()
};

jest.mock('sharp', () => jest.fn(() => mockSharpInstance));

jest.mock('fs', () => ({ readFileSync: jest.fn() }));

jest.mock('./fileServiceClient', () => ({
  uploadFile: jest.fn(),
  generateThumbnailFileId: jest.fn()
}));

import fs from 'fs';
import { uploadFile, generateThumbnailFileId } from './fileServiceClient';
import {
  generateThumbnailFromBuffer,
  generateThumbnailFromFile,
  generateThumbnailsBatch,
  isSupportedImageFormat
} from './thumbnailService';

const mockedReadFileSync = fs.readFileSync as unknown as jest.Mock;
const mockedUploadFile = uploadFile as unknown as jest.Mock;
const mockedGenerateThumbnailFileId = generateThumbnailFileId as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockSharpInstance.resize.mockReturnThis();
  mockSharpInstance.jpeg.mockReturnThis();
});

describe('generateThumbnailFromBuffer', () => {
  it('resizes, uploads, and returns the thumbnail result', async () => {
    const thumbnailBuffer = Buffer.from('thumb');
    mockSharpInstance.toBuffer.mockResolvedValue(thumbnailBuffer);
    mockSharpInstance.metadata.mockResolvedValue({ width: 300, height: 200 });
    mockedGenerateThumbnailFileId.mockReturnValue('user-1/album-1/123/thumbnail.jpg');
    mockedUploadFile.mockResolvedValue({});

    const result = await generateThumbnailFromBuffer(Buffer.from('original'), 'photo.jpg', 'user-1', 'album-1');

    expect(result).toEqual({
      thumbnailFileId: 'user-1/album-1/123/thumbnail.jpg',
      width: 300,
      height: 200,
      size: thumbnailBuffer.length
    });
    expect(mockedUploadFile).toHaveBeenCalledWith(
      thumbnailBuffer,
      'user-1/album-1/123/thumbnail.jpg',
      'image/jpeg',
      thumbnailBuffer.length
    );
  });

  it('falls back to the requested width/height when sharp metadata omits them', async () => {
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('thumb'));
    mockSharpInstance.metadata.mockResolvedValue({});
    mockedGenerateThumbnailFileId.mockReturnValue('id');
    mockedUploadFile.mockResolvedValue({});

    const result = await generateThumbnailFromBuffer(Buffer.from('x'), 'x.jpg', 'u1', 'a1', undefined, {
      width: 150,
      height: 150
    });

    expect(result.width).toBe(150);
    expect(result.height).toBe(150);
  });

  it('throws a generic error when thumbnail generation fails', async () => {
    mockSharpInstance.toBuffer.mockRejectedValue(new Error('sharp exploded'));

    await expect(generateThumbnailFromBuffer(Buffer.from('x'), 'x.jpg', 'u1', 'a1')).rejects.toThrow(
      'Thumbnail generation failed'
    );
  });
});

describe('generateThumbnailFromFile', () => {
  it('reads the file and delegates to generateThumbnailFromBuffer', async () => {
    mockedReadFileSync.mockReturnValue(Buffer.from('original'));
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('thumb'));
    mockSharpInstance.metadata.mockResolvedValue({ width: 10, height: 10 });
    mockedGenerateThumbnailFileId.mockReturnValue('id');
    mockedUploadFile.mockResolvedValue({});

    const result = await generateThumbnailFromFile('/tmp/photo.jpg', 'photo.jpg', 'u1', 'a1');

    expect(mockedReadFileSync).toHaveBeenCalledWith('/tmp/photo.jpg');
    expect(result.thumbnailFileId).toBe('id');
  });

  it('throws when the file cannot be read', async () => {
    mockedReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    await expect(generateThumbnailFromFile('/tmp/missing.jpg', 'x.jpg', 'u1', 'a1')).rejects.toThrow(
      'Failed to read source file for thumbnail generation'
    );
  });
});

describe('generateThumbnailsBatch', () => {
  it('processes images in batches and skips failures', async () => {
    mockedReadFileSync.mockImplementation((path: string) => {
      if (path === '/bad.jpg') throw new Error('corrupt');
      return Buffer.from('img');
    });
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('thumb'));
    mockSharpInstance.metadata.mockResolvedValue({ width: 1, height: 1 });
    mockedGenerateThumbnailFileId.mockReturnValue('id');
    mockedUploadFile.mockResolvedValue({});

    const items = [
      { filePath: '/a.jpg', originalFilename: 'a.jpg', userId: 'u1', albumId: 'a1' },
      { filePath: '/bad.jpg', originalFilename: 'bad.jpg', userId: 'u1', albumId: 'a1' }
    ];

    const results = await generateThumbnailsBatch(items);

    expect(results).toHaveLength(1);
  });

  it('processes more than one batch (batchSize=5)', async () => {
    mockedReadFileSync.mockReturnValue(Buffer.from('img'));
    mockSharpInstance.toBuffer.mockResolvedValue(Buffer.from('thumb'));
    mockSharpInstance.metadata.mockResolvedValue({ width: 1, height: 1 });
    mockedGenerateThumbnailFileId.mockReturnValue('id');
    mockedUploadFile.mockResolvedValue({});

    const items = Array.from({ length: 7 }, (_, i) => ({
      filePath: `/img-${i}.jpg`,
      originalFilename: `img-${i}.jpg`,
      userId: 'u1',
      albumId: 'a1'
    }));

    const results = await generateThumbnailsBatch(items);
    expect(results).toHaveLength(7);
  });
});

describe('isSupportedImageFormat', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('supports %s', (mimetype) => {
    expect(isSupportedImageFormat(mimetype)).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSupportedImageFormat('IMAGE/JPEG')).toBe(true);
  });

  it('excludes GIFs (animated, static thumbnails do not represent them well)', () => {
    expect(isSupportedImageFormat('image/gif')).toBe(false);
  });

  it('excludes video formats', () => {
    expect(isSupportedImageFormat('video/mp4')).toBe(false);
  });
});
