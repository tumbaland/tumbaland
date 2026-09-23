jest.mock('@tumbaland/backend-core', () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
  fileService: {
    getUploadUrl: jest.fn(),
    getDownloadUrls: jest.fn(),
    storedSize: jest.fn(),
    putFile: jest.fn(),
    getFile: jest.fn(),
    deleteFolder: jest.fn()
  }
}));

import { fileService } from '@tumbaland/backend-core';
import { getDownloadUrls, getUploadUrl } from './fileServiceClient';

const mocked = fileService as jest.Mocked<typeof fileService>;

afterEach(() => jest.clearAllMocks());

describe('getUploadUrl', () => {
  it('signs the size the quota was checked against into the URL', async () => {
    mocked.getUploadUrl.mockResolvedValue('https://files/upload?token=x');

    const url = await getUploadUrl('chat/g1/c1/a/original.jpg', 'image/jpeg', 15, 2048);

    expect(url).toBe('https://files/upload?token=x');
    expect(mocked.getUploadUrl).toHaveBeenCalledWith('chat/g1/c1/a/original.jpg', {
      mimetype: 'image/jpeg',
      expiresInMinutes: 15,
      maxBytes: 2048
    });
  });

  it('throws on a refusal, so the caller does not hand the browser a dead URL', async () => {
    mocked.getUploadUrl.mockRejectedValue(new Error('file-service POST /internal/upload-url -> 403'));

    await expect(getUploadUrl('f', 'image/jpeg')).rejects.toThrow(/403/);
  });
});

describe('getDownloadUrls', () => {
  it('maps each fileId to its URL', async () => {
    mocked.getDownloadUrls.mockResolvedValue({
      f1: { downloadUrl: 'u1', expiresMs: 1, expiresInMinutes: 60 },
      f2: { downloadUrl: 'u2', expiresMs: 1, expiresInMinutes: 60 }
    });

    const urls = await getDownloadUrls(['f1', 'f2']);

    expect(urls.get('f1')).toBe('u1');
    expect(urls.get('f2')).toBe('u2');
  });

  it('calls nothing for an empty list', async () => {
    expect((await getDownloadUrls([])).size).toBe(0);
    expect(mocked.getDownloadUrls).not.toHaveBeenCalled();
  });

  it('returns an empty map instead of throwing when file-service is down', async () => {
    // A thread that renders without its images beats one that fails to load.
    mocked.getDownloadUrls.mockRejectedValue(new Error('ECONNREFUSED'));

    expect((await getDownloadUrls(['f1'])).size).toBe(0);
  });
});
