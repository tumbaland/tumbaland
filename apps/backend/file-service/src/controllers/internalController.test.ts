import request from 'supertest';

jest.mock('../utils/storage', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  deleteFile: jest.fn(),
  deleteByPrefix: jest.fn(),
  fileExists: jest.fn(),
  getMetadata: jest.fn(),
  listFiles: jest.fn()
}));

import app from '../app';
import * as storage from '../utils/storage';

const mocked = storage as jest.Mocked<typeof storage>;
const API_KEY = 'test-api-key';

beforeAll(() => {
  process.env.FILE_SERVICE_API_KEY = API_KEY;
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /internal/files/:fileId (internalUpload)', () => {
  it('writes the request body buffer and returns its size', async () => {
    const res = await request(app)
      .put('/internal/files/a/b/file.bin')
      .set('x-internal-api-key', API_KEY)
      .send(Buffer.from('hello'));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, fileId: 'a/b/file.bin' });
    expect(mocked.writeFile).toHaveBeenCalledWith('a/b/file.bin', expect.any(Buffer));
  });

  it('returns 500 when writeFile throws', async () => {
    mocked.writeFile.mockImplementation(() => {
      throw new Error('disk full');
    });

    const res = await request(app)
      .put('/internal/files/a/b/file.bin')
      .set('x-internal-api-key', API_KEY)
      .send(Buffer.from('hello'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, message: 'Upload failed' });
  });
});

describe('GET /internal/files/:fileId (internalDownload)', () => {
  it('streams the file back with the right headers when it exists', async () => {
    mocked.fileExists.mockReturnValue(true);
    mocked.readFile.mockReturnValue(Buffer.from('file contents'));

    const res = await request(app).get('/internal/files/a/b/file.bin').set('x-internal-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(Buffer.isBuffer(res.body) ? res.body.toString() : res.text).toBe('file contents');
  });

  it('returns 404 when the file does not exist', async () => {
    mocked.fileExists.mockReturnValue(false);

    const res = await request(app).get('/internal/files/missing.bin').set('x-internal-api-key', API_KEY);

    expect(res.status).toBe(404);
  });
});

describe('HEAD /internal/files/:fileId (internalExists)', () => {
  it('returns 200 when the file exists', async () => {
    mocked.fileExists.mockReturnValue(true);

    const res = await request(app).head('/internal/files/a.bin').set('x-internal-api-key', API_KEY);

    expect(res.status).toBe(200);
  });

  it('returns 404 when the file does not exist', async () => {
    mocked.fileExists.mockReturnValue(false);

    const res = await request(app).head('/internal/files/a.bin').set('x-internal-api-key', API_KEY);

    expect(res.status).toBe(404);
  });
});

describe('GET /internal/meta/:fileId (internalMetadata)', () => {
  it('returns size and lastModified when the file exists', async () => {
    mocked.fileExists.mockReturnValue(true);
    const lastModified = new Date('2026-01-01T00:00:00.000Z');
    mocked.getMetadata.mockReturnValue({ size: 42, lastModified });

    const res = await request(app).get('/internal/meta/a.bin').set('x-internal-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ size: 42 });
  });

  it('returns 404 when the file does not exist', async () => {
    mocked.fileExists.mockReturnValue(false);

    const res = await request(app).get('/internal/meta/missing.bin').set('x-internal-api-key', API_KEY);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /internal/files/:fileId (internalDelete)', () => {
  it('deletes the file and returns success', async () => {
    const res = await request(app).delete('/internal/files/a.bin').set('x-internal-api-key', API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'File deleted' });
    expect(mocked.deleteFile).toHaveBeenCalledWith('a.bin');
  });
});

describe('DELETE /internal/files/folder (internalDeleteFolder)', () => {
  it('deletes all files under the given prefix and returns the count', async () => {
    mocked.deleteByPrefix.mockReturnValue(3);

    const res = await request(app)
      .delete('/internal/files/folder')
      .set('x-internal-api-key', API_KEY)
      .send({ prefix: 'albums/album-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Deleted 3 file(s)', count: 3 });
  });
});

describe('PUT /internal/files/folder (internalDeleteFolder, alternate method)', () => {
  it('also supports PUT for folder deletion', async () => {
    mocked.deleteByPrefix.mockReturnValue(1);

    const res = await request(app)
      .put('/internal/files/folder')
      .set('x-internal-api-key', API_KEY)
      .send({ prefix: 'albums/album-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Deleted 1 file(s)', count: 1 });
  });
});

describe('GET /internal/files (internalList)', () => {
  it('lists files, defaulting maxKeys to 1000 when not provided', async () => {
    mocked.listFiles.mockReturnValue([{ name: 'a.jpg', size: 10 }]);

    const res = await request(app).get('/internal/files').set('x-internal-api-key', API_KEY).query({ prefix: 'a' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ name: 'a.jpg', size: 10 }]);
    expect(mocked.listFiles).toHaveBeenCalledWith('a', 1000);
  });

  it('parses a custom maxKeys query param', async () => {
    mocked.listFiles.mockReturnValue([]);

    await request(app).get('/internal/files').set('x-internal-api-key', API_KEY).query({ maxKeys: '5' });

    expect(mocked.listFiles).toHaveBeenCalledWith(undefined, 5);
  });
});
