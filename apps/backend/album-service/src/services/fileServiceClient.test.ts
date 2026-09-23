jest.mock('@tumbaland/backend-core', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  fileService: {
    getUploadUrl: jest.fn(),
    getDownloadUrl: jest.fn(),
    getDownloadUrls: jest.fn(),
    putFile: jest.fn(),
    getFile: jest.fn(),
    deleteFile: jest.fn(),
    storedSize: jest.fn()
  }
}));

import { fileService } from '@tumbaland/backend-core';
import {
  albumFolder,
  deleteFile,
  generateFileId,
  generateThumbnailFileId,
  getPhotoSignedUrl,
  getPhotoSignedUrlsBatch,
  getSignedUrlsBatch,
  getUploadSignedUrl,
  uploadFile
} from './fileServiceClient';

const mocked = fileService as jest.Mocked<typeof fileService>;
const signed = (url: string) => ({ downloadUrl: url, expiresMs: Date.UTC(2026, 0, 1), expiresInMinutes: 60 });

afterEach(() => jest.clearAllMocks());

describe('file ids', () => {
  it('puts an upload under its album folder with the original extension', () => {
    const id = generateFileId('user-1', 'album-1', 'photo.jpg');
    expect(id).toMatch(/^user-1\/album-1\/\d+-[0-9a-f]{16}\/original\.jpg$/);
    expect(id.startsWith(albumFolder('album-1', 'user-1'))).toBe(true);
  });

  it('scopes to the group when there is one', () => {
    expect(generateFileId('user-1', 'album-1', 'photo.jpg', 'group-1').startsWith('group-1/album-1/')).toBe(true);
  });

  it('never repeats an id', () => {
    expect(generateFileId('u', 'a', 'x.jpg')).not.toBe(generateFileId('u', 'a', 'x.jpg'));
  });

  it('names a thumbnail thumbnail.jpg in the same album folder', () => {
    const id = generateThumbnailFileId('user-1', 'album-1', 'photo.png', 'group-1');
    expect(id).toMatch(/^group-1\/album-1\/\d+-[0-9a-f]{16}\/thumbnail\.jpg$/);
  });
});

describe('getUploadSignedUrl', () => {
  it('signs the size the quota was checked against into the URL', async () => {
    mocked.getUploadUrl.mockResolvedValue('https://upload.example');

    expect(await getUploadSignedUrl('a/b.jpg', 'image/jpeg', 10, 500)).toBe('https://upload.example');
    expect(mocked.getUploadUrl).toHaveBeenCalledWith('a/b.jpg', {
      mimetype: 'image/jpeg',
      expiresInMinutes: 10,
      maxBytes: 500
    });
  });
});

describe('getPhotoSignedUrl', () => {
  it('returns null when the photo has no file of that kind', async () => {
    expect(await getPhotoSignedUrl({}, false)).toBeNull();
    expect(await getPhotoSignedUrl({ minioFileId: 'x' }, true)).toBeNull();
    expect(mocked.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('signs the thumbnail when asked for one', async () => {
    mocked.getDownloadUrl.mockResolvedValue(signed('https://dl'));

    const data = await getPhotoSignedUrl({ minioFileId: 'orig.jpg', minioThumbnailFileId: 'thumb.jpg' }, true);

    expect(mocked.getDownloadUrl).toHaveBeenCalledWith('thumb.jpg', 60);
    expect(data).toEqual({ signedUrl: 'https://dl', expiresAt: '2026-01-01T00:00:00.000Z', expiresInMinutes: 60 });
  });

  it('returns null instead of throwing when signing fails', async () => {
    mocked.getDownloadUrl.mockRejectedValue(new Error('down'));

    expect(await getPhotoSignedUrl({ minioFileId: 'a.jpg' })).toBeNull();
  });
});

describe('getSignedUrlsBatch', () => {
  it('maps the batch answer back by fileId', async () => {
    mocked.getDownloadUrls.mockResolvedValue({ 'a.jpg': signed('https://a') });

    const result = await getSignedUrlsBatch(['a.jpg']);

    expect(result['a.jpg']).toMatchObject({ signedUrl: 'https://a', expiresAt: '2026-01-01T00:00:00.000Z' });
  });

  it('returns an empty result instead of throwing when file-service is down', async () => {
    mocked.getDownloadUrls.mockRejectedValue(new Error('down'));

    expect(await getSignedUrlsBatch(['a.jpg'])).toEqual({});
  });
});

describe('getPhotoSignedUrlsBatch', () => {
  it('keys results by minioFileId even when the thumbnail was signed', async () => {
    mocked.getDownloadUrls.mockResolvedValue({ 'thumb.jpg': signed('https://t') });

    const result = await getPhotoSignedUrlsBatch(
      [{ minioFileId: 'orig.jpg', minioThumbnailFileId: 'thumb.jpg' }],
      true
    );

    expect(mocked.getDownloadUrls).toHaveBeenCalledWith(['thumb.jpg'], 60);
    expect(result['orig.jpg']).toMatchObject({ signedUrl: 'https://t' });
  });

  it('skips photos missing the relevant file', async () => {
    mocked.getDownloadUrls.mockResolvedValue({});

    expect(await getPhotoSignedUrlsBatch([{ minioFileId: undefined }], false)).toEqual({});
  });
});

describe('uploadFile', () => {
  it('stores the bytes with their content type', async () => {
    const bytes = Buffer.from('data');

    await uploadFile(bytes, 'a.jpg', 'image/jpeg');

    expect(mocked.putFile).toHaveBeenCalledWith('a.jpg', bytes, 'image/jpeg');
  });

  it('throws when the write is refused', async () => {
    mocked.putFile.mockRejectedValue(new Error('file-service PUT /internal/files/a.jpg -> 500'));

    await expect(uploadFile(Buffer.from('data'), 'a.jpg', 'image/jpeg')).rejects.toThrow(/500/);
  });
});

describe('deleteFile', () => {
  it('returns true once the file is gone', async () => {
    mocked.deleteFile.mockResolvedValue();

    expect(await deleteFile('a.jpg')).toBe(true);
  });

  it('returns false instead of throwing, so the photo record still deletes', async () => {
    mocked.deleteFile.mockRejectedValue(new Error('down'));

    expect(await deleteFile('a.jpg')).toBe(false);
  });
});
