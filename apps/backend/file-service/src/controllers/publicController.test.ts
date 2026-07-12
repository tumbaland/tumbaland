import request from 'supertest';

jest.mock('../utils/storage', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  fileExists: jest.fn(),
  getMetadata: jest.fn()
}));

import app from '../app';
import * as storage from '../utils/storage';
import { signToken } from '../utils/hmac';

const mocked = storage as jest.Mocked<typeof storage>;

beforeAll(() => {
  process.env.FILE_SERVICE_HMAC_SECRET = 'test-hmac-secret';
});

beforeEach(() => {
  jest.clearAllMocks();
});

function signedQuery(operation: 'upload' | 'download', fileId: string) {
  const expiresMs = Date.now() + 60_000;
  const token = signToken(operation, fileId, expiresMs);
  return `token=${token}&expires=${expiresMs}`;
}

describe('PUT /files/upload/:fileId (uploadPublic)', () => {
  it('writes the uploaded buffer and returns success', async () => {
    const fileId = 'group/album/photo.jpg';
    const res = await request(app)
      .put(`/files/upload/${fileId}?${signedQuery('upload', fileId)}`)
      .send(Buffer.from('image bytes'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'File uploaded', fileId });
    expect(mocked.writeFile).toHaveBeenCalledWith(fileId, expect.any(Buffer));
  });

  it('returns 500 when writeFile throws', async () => {
    mocked.writeFile.mockImplementation(() => {
      throw new Error('disk full');
    });
    const fileId = 'group/album/photo.jpg';

    const res = await request(app)
      .put(`/files/upload/${fileId}?${signedQuery('upload', fileId)}`)
      .send(Buffer.from('image bytes'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Upload failed' });
  });

  it('rejects with 403 when the signed token was issued for the wrong fileId', async () => {
    const res = await request(app)
      .put(`/files/upload/actual-file.jpg?${signedQuery('upload', 'different-file.jpg')}`)
      .send(Buffer.from('x'));

    expect(res.status).toBe(403);
  });
});

describe('GET /files/download/:fileId (downloadPublic)', () => {
  it('returns 404 when the file does not exist', async () => {
    mocked.fileExists.mockReturnValue(false);
    const fileId = 'missing.jpg';

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.status).toBe(404);
  });

  it('streams the file with a guessed image/jpeg content type', async () => {
    mocked.fileExists.mockReturnValue(true);
    mocked.readFile.mockReturnValue(Buffer.from('jpeg bytes'));
    mocked.getMetadata.mockReturnValue({ size: 10, lastModified: new Date() });
    const fileId = 'group/album/photo.jpg';

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['cache-control']).toBe('private, max-age=3600');
    expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.text).toBe('jpeg bytes');
  });

  it('falls back to application/octet-stream for an unrecognized extension', async () => {
    mocked.fileExists.mockReturnValue(true);
    mocked.readFile.mockReturnValue(Buffer.from('data'));
    mocked.getMetadata.mockReturnValue({ size: 4, lastModified: new Date() });
    const fileId = 'group/album/file.xyz';

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
  });

  it('guesses video/mp4 for a .mp4 file', async () => {
    mocked.fileExists.mockReturnValue(true);
    mocked.readFile.mockReturnValue(Buffer.from('video bytes'));
    mocked.getMetadata.mockReturnValue({ size: 11, lastModified: new Date() });
    const fileId = 'group/album/clip.mp4';

    const res = await request(app).get(`/files/download/${fileId}?${signedQuery('download', fileId)}`);

    expect(res.headers['content-type']).toBe('video/mp4');
  });
});
