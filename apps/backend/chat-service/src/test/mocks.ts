/**
 * The collaborators the chat integration suites replace: file-service,
 * album-service and the storage meter. Each suite registers them with
 *
 *   jest.mock('./services/albumClient', () => jest.requireActual('./test/mocks').albumClientMock);
 *
 * and imports the same handles from here to set up and check calls. Both reach
 * one module instance, so what a test arranges is what the service sees.
 */

export const fileServiceClientMock = {
  getUploadUrl: jest.fn(async (fileId: string) => `https://files.test/upload/${fileId}?token=x`),
  getDownloadUrls: jest.fn(async (ids: string[]) => new Map(ids.map((id) => [id, `https://files.test/d/${id}`]))),
  uploadBuffer: jest.fn(async () => undefined),
  downloadBuffer: jest.fn(async () => Buffer.from('x')),
  // What file-service holds, which is what the meter is charged from.
  storedSize: jest.fn(async () => 1234 as number | null),
  // Async, like the real one: the caller chains .catch() on the result.
  deleteFolder: jest.fn(async () => undefined)
};

// album-service, as chat sees it. The real routes are tested in album-service.
export class FakeAlbumGone extends Error {}

export const albumCalls = {
  listAlbums: jest.fn(async () => [{ id: 'a-rome', name: 'Rome', photoCount: 3 }]),
  getAlbum: jest.fn(async (_groupId: string, albumId: string) =>
    albumId === 'a-rome'
      ? { id: 'a-rome', name: 'Rome', photoCount: 3 }
      : albumId === 'a-home'
        ? { id: 'a-home', name: 'Home', photoCount: 0 }
        : null
  ),
  createAlbum: jest.fn(async (_groupId: string, _userId: string, name: string) => ({ id: 'a-new', name, photoCount: 0 })),
  addChatPhoto: jest.fn(async (input: { albumId: string }) => ({ photoId: 'p1', albumId: input.albumId, albumName: 'Rome' })),
  removeChatPhotos: jest.fn(async () => ({ removed: 1 })),
  moveChatPhotos: jest.fn(async (_messageId: string, input: { albumId: string }) => ({ moved: 1, albumId: input.albumId, albumName: 'Home' })),
  createCollage: jest.fn(async (_groupId: string, input: { title: string }) => ({ id: 'k-1', title: input.title }))
};

export const albumClientMock = {
  AlbumGoneError: FakeAlbumGone,
  listAlbums: (...args: unknown[]) => (albumCalls.listAlbums as jest.Mock)(...args),
  getAlbum: (...args: unknown[]) => (albumCalls.getAlbum as jest.Mock)(...args),
  createAlbum: (...args: unknown[]) => (albumCalls.createAlbum as jest.Mock)(...args),
  addChatPhoto: (...args: unknown[]) => (albumCalls.addChatPhoto as jest.Mock)(...args),
  removeChatPhotos: (...args: unknown[]) => (albumCalls.removeChatPhotos as jest.Mock)(...args),
  moveChatPhotos: (...args: unknown[]) => (albumCalls.moveChatPhotos as jest.Mock)(...args),
  createCollage: (...args: unknown[]) => (albumCalls.createCollage as jest.Mock)(...args)
};

export const assertHeadroom = jest.fn();
export const recordStoredBytes = jest.fn();
export const releaseStoredBytes = jest.fn();

export const storageUsageMock = {
  assertHeadroom: (...args: unknown[]) => assertHeadroom(...args),
  recordStoredBytes: (...args: unknown[]) => recordStoredBytes(...args),
  releaseStoredBytes: (...args: unknown[]) => releaseStoredBytes(...args)
};
