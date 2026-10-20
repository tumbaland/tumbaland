jest.mock('@tumbaland/backend-core', () => ({
  // Tenant constants from the real module; see the note in relationship.test.ts.
  ...jest.requireActual('@tumbaland/backend-core/dist/apiKeys/types'),
  verifyApiKey: jest.fn(),
  verifyAccessToken: jest.fn(),
  looksLikeApiKey: (t: string) => typeof t === 'string' && t.startsWith('tmb_live_'),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  requireEnv: (name: string) => process.env[name] ?? `missing:${name}`
}));

jest.mock('../album', () => {
  const actual = jest.requireActual('../album');
  return {
    ...actual,
    album: {
      listAlbums: jest.fn(),
      listPhotos: jest.fn(),
      getMemories: jest.fn(),
      albumTags: jest.fn(),
      tagPhotos: jest.fn(),
      describePhoto: jest.fn(),
      getStatistics: jest.fn(),
      createAlbum: jest.fn(),
      uploadUrl: jest.fn(),
      createPhoto: jest.fn()
    }
  };
});

import request from 'supertest';
import { verifyApiKey } from '@tumbaland/backend-core';
import fixtures from '../__fixtures__/album-api.json';
import { album } from '../album';
import { createApp } from '../app';

const mockedVerify = verifyApiKey as jest.Mock;
const api = album as jest.Mocked<typeof album>;
const app = createApp();
const KEY = 'tmb_live_abcdef123456_aaaaaaaaaaaaaaaaaaaaaaaa';

async function callTool(name: string, args: Record<string, unknown> = {}) {
  const res = await request(app)
    .post('/mcp')
    .set('Authorization', `Bearer ${KEY}`)
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });

  const payload = JSON.parse(res.text.split('data: ')[1] ?? '{}');
  return {
    isError: Boolean(payload.result?.isError),
    text: payload.result?.content?.[0]?.text ?? ''
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedVerify.mockResolvedValue({
    ok: true,
    userId: 'u1',
    keyId: 'k1',
    scopes: ['album:read', 'album:write'],
    tenants: { allowed: ['personal'], default: 'personal' },
    tenantNames: { personal: 'My own data' }
  });
  api.listAlbums.mockResolvedValue(fixtures.albums as never);
  api.listPhotos.mockResolvedValue(fixtures.photos as never);
  api.getMemories.mockResolvedValue(fixtures.memories as never);
});

describe('list_albums', () => {
  it('leads with the totals, since it is the way into the library', async () => {
    const { text } = await callTool('list_albums');

    expect(text).toContain('2 albums, 51 photos');
    expect(text).toContain('Finland 2025: 16 photos, 66 MB');
  });

  it('does not ask for cover photos, which cost a signed URL each', async () => {
    await callTool('list_albums');
    // Nothing here can display an image, and every cover is a round trip to
    // the file service.
    expect(api.listAlbums).toHaveBeenCalledWith(KEY, expect.objectContaining({ limit: 100 }));
  });

  it('says plainly when a search matches nothing', async () => {
    api.listAlbums.mockResolvedValue({ albums: [], pagination: { total: 0, page: 1, pages: 0 } } as never);
    const { text } = await callTool('list_albums', { search: 'Iceland' });
    expect(text).toBe('No album matches "Iceland".');
  });
});

describe('search_photos', () => {
  it('resolves an album by name, so no id ever reaches the model', async () => {
    await callTool('search_photos', { albumName: 'Finland 2025' });
    expect(api.listPhotos).toHaveBeenCalledWith(KEY, '685a7b72414b3995b5f1f872', expect.any(Object));
  });

  it('accepts a partial name, since "Spain" should find "Spain 2024"', async () => {
    await callTool('search_photos', { albumName: 'finland' });
    expect(api.listPhotos).toHaveBeenCalledWith(KEY, '685a7b72414b3995b5f1f872', expect.any(Object));
  });

  it('asks which one when a partial name matches several', async () => {
    const { isError, text } = await callTool('search_photos', { albumName: '20' });

    // Guessing between two albums is how a photo ends up described in the
    // wrong one.
    expect(isError).toBe(true);
    expect(text).toContain('matches more than one album');
    expect(api.listPhotos).not.toHaveBeenCalled();
  });

  it('lists the real albums when the name is wrong', async () => {
    const { isError, text } = await callTool('search_photos', { albumName: 'Iceland' });

    expect(isError).toBe(true);
    expect(text).toContain('Finland 2025, Tartu 2024');
  });

  it('shows the capture date, the name and the id needed to act on it', async () => {
    const { text } = await callTool('search_photos', { albumName: 'Finland 2025' });

    expect(text).toContain('2025-06-14 PXL_20250614_072211118.MP.jpg');
    expect(text).toContain('The ferris wheel [rides]');
    expect(text).toMatch(/\[id [a-f0-9]{24}\]/);
  });

  it('reports the total behind the filter, not the page', async () => {
    const { text } = await callTool('search_photos', { albumName: 'Finland 2025' });
    expect(text).toContain('16 in Finland 2025, showing 2');
  });
});

describe('get_photo_memories', () => {
  it('spans every album, which no other search does', async () => {
    const { text } = await callTool('get_photo_memories');

    expect(text).toContain('Finland 2025');
    expect(text).toContain('Tartu 2024');
  });

  it('marks a photo dated by upload rather than by capture', async () => {
    // Blurring the two would claim to know when a picture was taken.
    const { text } = await callTool('get_photo_memories');

    expect(text).toContain('IMG_0042.jpg in Tartu 2024 (by upload date)');
    expect(text).not.toContain('PXL_20250904_120000000.jpg in Finland 2025 (by upload date)');
  });

  it('says so when there is no history for today', async () => {
    api.getMemories.mockResolvedValue({ date: '2026-09-05', totalPhotos: 0, years: [] } as never);
    const { text } = await callTool('get_photo_memories');
    expect(text).toContain('Nothing was photographed around this date');
  });
});

describe('tag_photos', () => {
  it('reports what actually changed, not what was asked for', async () => {
    // A photo in an album the credential cannot reach is dropped silently, so
    // echoing the request would overstate what happened.
    api.tagPhotos.mockResolvedValue({ matched: 2, modified: 2 });

    const { text } = await callTool('tag_photos', { photoIds: ['p1', 'p2', 'p3'], add: ['beach'] });

    expect(text).toBe('added beach on 2 of 2 photos.');
  });

  it('refuses a call that changes nothing', async () => {
    const { text } = await callTool('tag_photos', { photoIds: ['p1'] });

    expect(text).toContain('at least one tag');
    expect(api.tagPhotos).not.toHaveBeenCalled();
  });

  it('passes adds and removes through together', async () => {
    api.tagPhotos.mockResolvedValue({ matched: 1, modified: 1 });

    await callTool('tag_photos', { photoIds: ['p1'], add: ['beach'], remove: ['blurry'] });

    expect(api.tagPhotos).toHaveBeenCalledWith(KEY, {
      photoIds: ['p1'],
      add: ['beach'],
      remove: ['blurry']
    });
  });
});

describe('describe_photo', () => {
  it('sets a title', async () => {
    api.describePhoto.mockResolvedValue({} as never);

    const { text } = await callTool('describe_photo', { id: 'p1', title: 'The ferris wheel' });

    expect(api.describePhoto).toHaveBeenCalledWith(KEY, 'p1', {
      title: 'The ferris wheel',
      description: undefined
    });
    expect(text).toContain('The ferris wheel');
  });

  it('refuses a call that changes nothing', async () => {
    const { text } = await callTool('describe_photo', { id: 'p1' });
    expect(text).toContain('Give a title or a description');
    expect(api.describePhoto).not.toHaveBeenCalled();
  });
});

describe('create_album', () => {
  it('makes the album in the journal the call acts in', async () => {
    api.createAlbum.mockResolvedValue({ _id: 'a9', name: '1000 days in numbers', photoCount: 0, totalSize: 0 });

    const { text } = await callTool('create_album', { name: '1000 days in numbers' });

    expect(api.createAlbum).toHaveBeenCalledWith(KEY, {
      name: '1000 days in numbers',
      description: undefined,
      groupId: 'personal'
    });
    expect(text).toContain('Made the album "1000 days in numbers"');
  });

  it('uses an album that already has the name rather than making a second', async () => {
    const { text } = await callTool('create_album', { name: 'finland 2025' });

    expect(text).toContain('already an album called "Finland 2025"');
    expect(api.createAlbum).not.toHaveBeenCalled();
  });
});

describe('start_photo_upload', () => {
  it('hands back the link and what to pass to finish_photo_upload', async () => {
    api.uploadUrl.mockResolvedValue({
      uploadUrl: 'https://files.example/files/upload/u1/a1/chart.png?token=t',
      minioFileId: 'u1/a1/chart.png',
      expiresInMinutes: 15
    });

    const { text } = await callTool('start_photo_upload', {
      albumName: 'Finland',
      filename: 'chart.png',
      contentType: 'image/png',
      sizeBytes: 12345
    });

    const albumId = fixtures.albums.albums[0]._id;
    expect(api.uploadUrl).toHaveBeenCalledWith(KEY, {
      albumId,
      filename: 'chart.png',
      mimetype: 'image/png',
      sizeBytes: 12345
    });
    expect(text).toContain("curl --fail -X PUT -H 'Content-Type: image/png'");
    expect(text).toContain("'https://files.example/files/upload/u1/a1/chart.png?token=t'");
    expect(text).toContain('uploadId "u1/a1/chart.png"');
  });

  it('refuses anything that is not a picture', async () => {
    const { isError } = await callTool('start_photo_upload', {
      albumName: 'Finland',
      filename: 'notes.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10
    });

    expect(isError).toBe(true);
    expect(api.uploadUrl).not.toHaveBeenCalled();
  });
});

describe('finish_photo_upload', () => {
  it('records the uploaded file as a photo in the album', async () => {
    api.createPhoto.mockResolvedValue({
      _id: 'p9',
      originalName: 'chart.png',
      title: 'Hours together',
      tags: [],
      size: 12345
    });

    const { text } = await callTool('finish_photo_upload', {
      albumName: 'Finland 2025',
      uploadId: 'u1/a1/chart.png',
      filename: 'chart.png',
      contentType: 'image/png',
      sizeBytes: 12345,
      width: 2000,
      height: 1250,
      title: 'Hours together'
    });

    expect(api.createPhoto).toHaveBeenCalledWith(KEY, {
      albumId: fixtures.albums.albums[0]._id,
      minioFileId: 'u1/a1/chart.png',
      filename: 'chart.png',
      originalName: 'chart.png',
      mimetype: 'image/png',
      size: 12345,
      width: 2000,
      height: 1250,
      title: 'Hours together',
      description: undefined
    });
    expect(text).toBe('Added Hours together to Finland 2025  [photo p9]');
  });
});

describe('scope gating', () => {
  it('hides the writing tools from a read-only album key', async () => {
    mockedVerify.mockResolvedValue({
      ok: true,
      userId: 'u1',
      keyId: 'k1',
      scopes: ['album:read'],
      tenants: { allowed: ['personal'], default: 'personal' },
      tenantNames: {}
    });

    const { isError } = await callTool('tag_photos', { photoIds: ['p1'], add: ['x'] });

    expect(isError).toBe(true);
    expect(api.tagPhotos).not.toHaveBeenCalled();
  });
});
