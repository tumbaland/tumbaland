jest.mock('@tumbaland/backend-core', () => ({ logger: { warn: jest.fn() } }));

import { logger } from '@tumbaland/backend-core';
import {
  AlbumGoneError,
  addChatPhoto,
  createAlbum,
  createCollage,
  getAlbum,
  listAlbums,
  moveChatPhotos,
  removeChatPhotos
} from './albumClient';

const originalEnv = {
  ALBUM_INTERNAL_URL: process.env.ALBUM_INTERNAL_URL,
  ALBUM_API_URL: process.env.ALBUM_API_URL,
  INTERNAL_SERVICE_TOKEN: process.env.INTERNAL_SERVICE_TOKEN,
  SERVICE_NAME: process.env.SERVICE_NAME
};

let fetchMock: jest.SpyInstance;

beforeEach(() => {
  process.env.ALBUM_INTERNAL_URL = 'http://album-service:4002/';
  process.env.ALBUM_API_URL = 'https://album.example';
  process.env.INTERNAL_SERVICE_TOKEN = 'internal-test-token';
  delete process.env.SERVICE_NAME;
  fetchMock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { id: 'a1', name: 'Shared album', photoCount: 0 } }))
    );
});

afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

it('authenticates internal requests and encodes group IDs as one path segment', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] })));

  await expect(listAlbums('group/with spaces')).resolves.toEqual([]);
  expect(fetchMock).toHaveBeenCalledWith(
    'http://album-service:4002/internal/groups/group%2Fwith%20spaces/albums',
    expect.objectContaining({
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-token': 'internal-test-token',
        'x-service-id': 'chat-service'
      },
      body: undefined,
      signal: expect.any(AbortSignal)
    })
  );
});

it('uses the public album address when there is no container-network address', async () => {
  delete process.env.ALBUM_INTERNAL_URL;
  process.env.SERVICE_NAME = 'custom-chat';

  await listAlbums('g1');

  expect(fetchMock).toHaveBeenCalledWith(
    'https://album.example/internal/groups/g1/albums',
    expect.objectContaining({ headers: expect.objectContaining({ 'x-service-id': 'custom-chat' }) })
  );
});

it('uses the local development address when neither album address is configured', async () => {
  delete process.env.ALBUM_INTERNAL_URL;
  delete process.env.ALBUM_API_URL;

  await listAlbums('g1');

  expect(fetchMock).toHaveBeenCalledWith('http://localhost:4002/internal/groups/g1/albums', expect.any(Object));
});

it('refuses to send a request without an internal service token', async () => {
  delete process.env.INTERNAL_SERVICE_TOKEN;

  await expect(listAlbums('g1')).rejects.toThrow('INTERNAL_SERVICE_TOKEN is not configured');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('fetches one album without letting its ID change the request path', async () => {
  await expect(getAlbum('g1', 'album/1')).resolves.toEqual({ id: 'a1', name: 'Shared album', photoCount: 0 });
  expect(fetchMock).toHaveBeenCalledWith(
    'http://album-service:4002/internal/groups/g1/albums/album%2F1',
    expect.objectContaining({ method: 'GET' })
  );
});

it('treats a deleted or inaccessible album as absent', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

  await expect(getAlbum('g1', 'gone')).resolves.toBeNull();
});

it('propagates service outages instead of treating them as deleted albums', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 503 }));

  await expect(getAlbum('g1', 'a1')).rejects.toThrow('album-service GET /internal/groups/g1/albums/a1 -> 503');
  expect(logger.warn).toHaveBeenCalledWith('album-service call failed', expect.objectContaining({ status: 503 }));
});

it('propagates transport errors', async () => {
  fetchMock.mockRejectedValue(new Error('connection refused'));

  await expect(listAlbums('g1')).rejects.toThrow('connection refused');
});

it('creates an album owned by the supplied user', async () => {
  await createAlbum('g1', 'u1', 'Shared album');

  expect(fetchMock).toHaveBeenCalledWith(
    'http://album-service:4002/internal/groups/g1/albums',
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Shared album', userId: 'u1' }) })
  );
});

it('retains the chat attachment metadata when saving a photo', async () => {
  const input = {
    groupId: 'g1',
    albumId: 'a1',
    conversationId: 'c1',
    messageId: 'm1',
    fileId: 'f1',
    mimetype: 'image/jpeg',
    size: 1024,
    takenAt: '2026-01-01T00:00:00.000Z'
  };

  await addChatPhoto(input);

  expect(fetchMock).toHaveBeenCalledWith(
    'http://album-service:4002/internal/chat-photos',
    expect.objectContaining({ method: 'POST', body: JSON.stringify(input) })
  );
});

it('reports missing destinations as AlbumGoneError for write requests', async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

  await expect(createAlbum('g1', 'u1', 'Gone')).rejects.toBeInstanceOf(AlbumGoneError);
});

it('moves only the selected attachments to the requested album', async () => {
  const input = { groupId: 'g1', albumId: 'a2', fileIds: ['f1'] };

  await moveChatPhotos('message/1', input);

  expect(fetchMock).toHaveBeenCalledWith(
    'http://album-service:4002/internal/chat-photos/message%2F1/move',
    expect.objectContaining({ method: 'POST', body: JSON.stringify(input) })
  );
});

it.each([
  [undefined, ''],
  ['file/1?raw', '?fileId=file%2F1%3Fraw']
])('removes a whole message or a single encoded file (%s)', async (fileId, suffix) => {
  await removeChatPhotos('message/1', fileId);

  expect(fetchMock).toHaveBeenCalledWith(
    `http://album-service:4002/internal/chat-photos/message%2F1${suffix}`,
    expect.objectContaining({ method: 'DELETE', body: undefined })
  );
});

it('creates a collage with the originating chat and user', async () => {
  const input = { clientId: 'client-1', userId: 'u1', albumId: 'a1', conversationId: 'c1', title: 'Together' };

  await createCollage('group/1', input);

  expect(fetchMock).toHaveBeenCalledWith(
    'http://album-service:4002/internal/groups/group%2F1/collages',
    expect.objectContaining({ method: 'POST', body: JSON.stringify(input) })
  );
});
