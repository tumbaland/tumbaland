import { Request, Response } from 'express';

jest.mock('../services/albumService', () => ({
  __esModule: true,
  default: {
    createAlbum: jest.fn(),
    getAlbums: jest.fn(),
    getAlbumById: jest.fn(),
    updateAlbum: jest.fn(),
    deleteAlbum: jest.fn(),
    setCoverPhoto: jest.fn(),
    removeCoverPhoto: jest.fn()
  }
}));

import albumService from '../services/albumService';
import {
  createAlbum,
  getAlbums,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  setCoverPhoto,
  removeCoverPhoto
} from './albumController';

const mocked = albumService as jest.Mocked<typeof albumService>;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'user-1' }, userGroups: [], body: {}, params: {}, query: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('createAlbum', () => {
  it('creates the album and returns 201', async () => {
    mocked.createAlbum.mockResolvedValue({ _id: 'a1', name: 'Trip' } as any);
    const res = mockRes();

    await createAlbum(baseReq({ body: { name: 'Trip' } }), res);

    expect(mocked.createAlbum).toHaveBeenCalledWith({ name: 'Trip' }, 'user-1');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { _id: 'a1', name: 'Trip' } }));
  });
});

describe('getAlbums', () => {
  it('parses query params and returns albums with pagination', async () => {
    mocked.getAlbums.mockResolvedValue({ albums: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
    const res = mockRes();

    await getAlbums(baseReq({ query: { page: '2', limit: '5', isPublic: 'true' } }), res);

    expect(mocked.getAlbums).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, isPublic: true }),
      expect.objectContaining({ userId: 'user-1' })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('defaults includeCover to true when the query param is absent', async () => {
    mocked.getAlbums.mockResolvedValue({ albums: [], pagination: { page: 1, limit: 10, total: 0, pages: 0 } });
    const res = mockRes();

    await getAlbums(baseReq(), res);

    expect(mocked.getAlbums).toHaveBeenCalledWith(expect.objectContaining({ includeCover: true }), expect.anything());
  });
});

describe('getAlbumById', () => {
  it('returns the album', async () => {
    mocked.getAlbumById.mockResolvedValue({ _id: 'a1' } as any);
    const res = mockRes();

    await getAlbumById(baseReq({ params: { id: 'a1' } }), res);

    expect(mocked.getAlbumById).toHaveBeenCalledWith('a1', expect.objectContaining({ userId: 'user-1' }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { _id: 'a1' } }));
  });
});

describe('updateAlbum', () => {
  it('updates the album', async () => {
    mocked.updateAlbum.mockResolvedValue({ _id: 'a1', name: 'New' } as any);
    const res = mockRes();

    await updateAlbum(baseReq({ params: { id: 'a1' }, body: { name: 'New' } }), res);

    expect(mocked.updateAlbum).toHaveBeenCalledWith('a1', expect.objectContaining({ name: 'New' }), expect.anything());
  });
});

describe('deleteAlbum', () => {
  it('deletes the album', async () => {
    mocked.deleteAlbum.mockResolvedValue(undefined);
    const res = mockRes();

    await deleteAlbum(baseReq({ params: { id: 'a1' } }), res);

    expect(mocked.deleteAlbum).toHaveBeenCalledWith('a1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('setCoverPhoto', () => {
  it('sets the cover photo', async () => {
    mocked.setCoverPhoto.mockResolvedValue({ _id: 'a1', coverPhotoId: 'p1' } as any);
    const res = mockRes();

    await setCoverPhoto(baseReq({ params: { id: 'a1' }, body: { photoId: 'p1' } }), res);

    expect(mocked.setCoverPhoto).toHaveBeenCalledWith('a1', 'p1');
  });
});

describe('removeCoverPhoto', () => {
  it('removes the cover photo', async () => {
    mocked.removeCoverPhoto.mockResolvedValue({ _id: 'a1' } as any);
    const res = mockRes();

    await removeCoverPhoto(baseReq({ params: { id: 'a1' } }), res);

    expect(mocked.removeCoverPhoto).toHaveBeenCalledWith('a1');
  });
});
