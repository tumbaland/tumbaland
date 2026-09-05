import { Request, Response } from 'express';
import { PaymentRequiredError } from '@tumbaland/backend-core';

jest.mock('../services/photoService', () => ({
  __esModule: true,
  default: {
    createPhoto: jest.fn(),
    getPhotosByAlbum: jest.fn(),
    getAlbumTags: jest.fn(),
    bulkUpdateTags: jest.fn(),
    getPhotoById: jest.fn(),
    updatePhoto: jest.fn(),
    deletePhoto: jest.fn(),
    updatePhotoAIAnalysis: jest.fn(),
    getPhotosForAIAnalysis: jest.fn(),
    getPhotoByFileId: jest.fn()
  }
}));

jest.mock('../services/memoriesService', () => ({
  __esModule: true,
  default: { getMemories: jest.fn() }
}));

jest.mock('../services/fileServiceClient', () => ({
  getUploadSignedUrl: jest.fn(),
  generateFileId: jest.fn()
}));

jest.mock('../models/Album', () => ({ __esModule: true, default: { findById: jest.fn() } }));

jest.mock('../services/storageUsage', () => ({
  storageActor: jest.fn(() => ({ email: 'caller@example.com', userId: 'user-1' })),
  assertStorageHeadroom: jest.fn(),
  recordStoredBytes: jest.fn(),
  releaseStoredBytes: jest.fn()
}));

import photoService from '../services/photoService';
import memoriesService from '../services/memoriesService';
import { getUploadSignedUrl, generateFileId } from '../services/fileServiceClient';
import Album from '../models/Album';
import { assertStorageHeadroom, recordStoredBytes, releaseStoredBytes } from '../services/storageUsage';
import {
  createPhoto,
  getPhotosByAlbum,
  getAlbumTags,
  bulkUpdateTags,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  getUploadSignedUrlRequest,
  updatePhotoAIAnalysis,
  getPhotosForAIAnalysis,
  getPhotoByFileId,
  getMemories
} from './photoController';

const mockedPhotoService = photoService as jest.Mocked<typeof photoService>;
const mockedMemoriesService = memoriesService as jest.Mocked<typeof memoriesService>;
const mockedGetUploadSignedUrl = getUploadSignedUrl as jest.Mock;
const mockedGenerateFileId = generateFileId as jest.Mock;
const mockedAlbumFindById = Album.findById as unknown as jest.Mock;
const mockedHeadroom = assertStorageHeadroom as jest.Mock;
const mockedRecord = recordStoredBytes as jest.Mock;
const mockedRelease = releaseStoredBytes as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

const baseReq = (overrides: Partial<Request> = {}) =>
  ({ user: { id: 'user-1' }, body: {}, params: {}, query: {}, ...overrides }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe('createPhoto', () => {
  it('looks up the album to derive groupId, then creates the photo', async () => {
    mockedAlbumFindById.mockResolvedValue({ groupId: 'group-1' });
    mockedPhotoService.createPhoto.mockResolvedValue({ _id: 'p1' } as any);
    const res = mockRes();

    await createPhoto(baseReq({ body: { albumId: 'a1', filename: 'x.jpg' } }), res);

    expect(mockedPhotoService.createPhoto).toHaveBeenCalledWith(
      { albumId: 'a1', filename: 'x.jpg' },
      'user-1',
      'group-1'
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('records the stored bytes against the album\'s meter', async () => {
    mockedAlbumFindById.mockResolvedValue({ userId: 'user-1', groupId: 'group-1' });
    mockedPhotoService.createPhoto.mockResolvedValue({ _id: 'p1', size: 5_000 } as any);

    await createPhoto(baseReq({ body: { albumId: 'a1', size: 5_000 } }), mockRes());

    expect(mockedRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ groupId: 'group-1' }),
      5_000
    );
  });
});

describe('tag endpoints', () => {
  it('accepts a comma-separated tags param', async () => {
    mockedPhotoService.getPhotosByAlbum.mockResolvedValue({ photos: [], pagination: { page: 1, total: 0, pages: 0 } });

    await getPhotosByAlbum(baseReq({ params: { albumId: 'a1' }, query: { tags: 'beach, sunset' } }), mockRes());

    expect(mockedPhotoService.getPhotosByAlbum).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ tags: ['beach', 'sunset'], tagMatch: 'all' })
    );
  });

  it('accepts a repeated tags param', async () => {
    mockedPhotoService.getPhotosByAlbum.mockResolvedValue({ photos: [], pagination: { page: 1, total: 0, pages: 0 } });

    await getPhotosByAlbum(
      baseReq({ params: { albumId: 'a1' }, query: { tags: ['beach', 'sunset'], tagMatch: 'any' } }),
      mockRes()
    );

    expect(mockedPhotoService.getPhotosByAlbum).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ tags: ['beach', 'sunset'], tagMatch: 'any' })
    );
  });

  it('falls back to matching all tags for an unrecognised tagMatch', async () => {
    mockedPhotoService.getPhotosByAlbum.mockResolvedValue({ photos: [], pagination: { page: 1, total: 0, pages: 0 } });

    await getPhotosByAlbum(baseReq({ params: { albumId: 'a1' }, query: { tags: 'beach', tagMatch: 'weird' } }), mockRes());

    expect(mockedPhotoService.getPhotosByAlbum).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ tagMatch: 'all' })
    );
  });

  it('returns the album tag list', async () => {
    mockedPhotoService.getAlbumTags.mockResolvedValue([{ tag: 'beach', count: 2 }]);
    const res = mockRes();

    await getAlbumTags(baseReq({ params: { albumId: 'a1' } }), res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tags: [{ tag: 'beach', count: 2 }] } })
    );
  });

  it('passes the bulk tag payload through to the service', async () => {
    mockedPhotoService.bulkUpdateTags.mockResolvedValue({ matched: 2, modified: 2, tags: [] });

    await bulkUpdateTags(
      baseReq({ body: { photoIds: ['p1', 'p2'], add: ['beach'], remove: ['old'] } }),
      mockRes()
    );

    // Every by-id and bulk route now carries the caller down to the query. A
    // photo carries no owner of its own, so without this any signed-in caller
    // could retag any other account's photos by naming their ids.
    expect(mockedPhotoService.bulkUpdateTags).toHaveBeenCalledWith(
      { photoIds: ['p1', 'p2'], add: ['beach'], remove: ['old'] },
      { userId: 'user-1', userGroups: [] }
    );
  });
});

describe('getPhotosByAlbum', () => {
  it('parses pagination query params', async () => {
    mockedPhotoService.getPhotosByAlbum.mockResolvedValue({
      photos: [],
      pagination: { page: 1, total: 0, pages: 0 }
    });
    const res = mockRes();

    await getPhotosByAlbum(baseReq({ params: { albumId: 'a1' }, query: { page: '2', limit: '5' } }), res);

    expect(mockedPhotoService.getPhotosByAlbum).toHaveBeenCalledWith('a1', {
      page: 2,
      limit: 5,
      search: undefined,
      tags: undefined,
      tagMatch: 'all'
    });
  });
});

describe('getPhotoById', () => {
  it('returns the photo', async () => {
    mockedPhotoService.getPhotoById.mockResolvedValue({ _id: 'p1' } as any);
    const res = mockRes();

    await getPhotoById(baseReq({ params: { id: 'p1' } }), res);

    expect(mockedPhotoService.getPhotoById).toHaveBeenCalledWith('p1', {
      userId: 'user-1',
      userGroups: []
    });
  });
});

describe('updatePhoto', () => {
  it('updates the photo metadata', async () => {
    mockedPhotoService.updatePhoto.mockResolvedValue({ _id: 'p1', title: 'New' } as any);
    const res = mockRes();

    await updatePhoto(baseReq({ params: { id: 'p1' }, body: { title: 'New' } }), res);

    expect(mockedPhotoService.updatePhoto).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ title: 'New' }),
      { userId: 'user-1', userGroups: [] }
    );
  });
});

describe('deletePhoto', () => {
  it('deletes the photo and hands its bytes back to the meter', async () => {
    mockedPhotoService.deletePhoto.mockResolvedValue({ albumId: 'a1', size: 2_048 } as any);
    mockedAlbumFindById.mockResolvedValue({ userId: 'user-1', groupId: 'group-1' });
    const res = mockRes();

    await deletePhoto(baseReq({ params: { id: 'p1' } }), res);

    expect(mockedPhotoService.deletePhoto).toHaveBeenCalledWith('p1', {
      userId: 'user-1',
      userGroups: []
    });
    expect(mockedRelease).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ groupId: 'group-1' }),
      2_048
    );
  });

  it('still reports success when the album is already gone', async () => {
    // The album delete path frees its own bytes, so there is nothing to release
    // and nothing here should turn that into a 500 for the caller.
    mockedPhotoService.deletePhoto.mockResolvedValue({ albumId: 'a1', size: 2_048 } as any);
    mockedAlbumFindById.mockResolvedValue(null);
    const res = mockRes();

    await deletePhoto(baseReq({ params: { id: 'p1' } }), res);

    expect(mockedRelease).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('getUploadSignedUrlRequest', () => {
  it('throws UnauthorizedError when there is no authenticated user', async () => {
    const res = mockRes();

    await expect(
      getUploadSignedUrlRequest(baseReq({ user: undefined, body: { albumId: 'a1' } }), res)
    ).rejects.toThrow('Access token required');
  });

  it('throws NotFoundError when the album does not exist', async () => {
    mockedAlbumFindById.mockResolvedValue(null);
    const res = mockRes();

    await expect(
      getUploadSignedUrlRequest(baseReq({ body: { albumId: 'missing' } }), res)
    ).rejects.toThrow('Album not found');
  });

  it('generates a fileId and returns a signed upload URL', async () => {
    mockedAlbumFindById.mockResolvedValue({ groupId: 'group-1' });
    mockedGenerateFileId.mockReturnValue('group-1/a1/123/original.jpg');
    mockedGetUploadSignedUrl.mockResolvedValue('https://upload.example');
    const res = mockRes();

    await getUploadSignedUrlRequest(
      baseReq({ body: { filename: 'photo.jpg', mimetype: 'image/jpeg', albumId: 'a1' } }),
      res
    );

    expect(mockedGenerateFileId).toHaveBeenCalledWith('user-1', 'a1', 'photo.jpg', 'group-1');
    expect(mockedGetUploadSignedUrl).toHaveBeenCalledWith('group-1/a1/123/original.jpg', 'image/jpeg', 15);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ uploadUrl: 'https://upload.example' }) })
    );
  });

  it('checks the storage quota against the album before issuing a URL', async () => {
    mockedAlbumFindById.mockResolvedValue({ userId: 'user-1', groupId: 'group-1' });
    mockedGenerateFileId.mockReturnValue('file-1');
    mockedGetUploadSignedUrl.mockResolvedValue('https://upload.example');

    await getUploadSignedUrlRequest(
      baseReq({ body: { filename: 'p.jpg', mimetype: 'image/jpeg', albumId: 'a1', sizeBytes: 12_345 } }),
      mockRes()
    );

    expect(mockedHeadroom).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ groupId: 'group-1' }),
      12_345
    );
  });

  it('issues no URL when the quota gate refuses — the bytes are never written', async () => {
    mockedAlbumFindById.mockResolvedValue({ userId: 'user-1' });
    mockedHeadroom.mockRejectedValueOnce(new PaymentRequiredError('Limit reached for storageBytes', { code: 'QUOTA_EXCEEDED', meter: 'storageBytes' }));

    await expect(
      getUploadSignedUrlRequest(
        baseReq({ body: { filename: 'p.jpg', mimetype: 'image/jpeg', albumId: 'a1', sizeBytes: 12_345 } }),
        mockRes()
      )
    ).rejects.toMatchObject({ statusCode: 402 });

    expect(mockedGetUploadSignedUrl).not.toHaveBeenCalled();
  });
});

describe('updatePhotoAIAnalysis', () => {
  it('updates the AI analysis fields', async () => {
    mockedPhotoService.updatePhotoAIAnalysis.mockResolvedValue({ _id: 'p1' } as any);
    const res = mockRes();

    await updatePhotoAIAnalysis(baseReq({ params: { id: 'p1' }, body: { objectDetection: { jobId: 'j1' } } }), res);

    expect(mockedPhotoService.updatePhotoAIAnalysis).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ objectDetection: { jobId: 'j1' } })
    );
  });
});

describe('getPhotosForAIAnalysis', () => {
  it('defaults limit to 50', async () => {
    mockedPhotoService.getPhotosForAIAnalysis.mockResolvedValue([]);
    const res = mockRes();

    await getPhotosForAIAnalysis(baseReq({ params: { albumId: 'a1' } }), res);

    expect(mockedPhotoService.getPhotosForAIAnalysis).toHaveBeenCalledWith('a1', 50);
  });
});

describe('getPhotoByFileId', () => {
  it('returns the photo for a given fileId', async () => {
    mockedPhotoService.getPhotoByFileId.mockResolvedValue({ _id: 'p1' } as any);
    const res = mockRes();

    await getPhotoByFileId(baseReq({ params: { fileId: 'file-1' } }), res);

    expect(mockedPhotoService.getPhotoByFileId).toHaveBeenCalledWith('file-1');
  });
});

describe('getMemories', () => {
  const emptyResult = { date: '2026-09-03', windowDays: 3, totalPhotos: 0, years: [] };

  beforeEach(() => mockedMemoriesService.getMemories.mockResolvedValue(emptyResult));

  it('passes the scope and the caller\'s groups through', async () => {
    const req = baseReq({ query: { groupId: 'g1' }, userGroups: ['g1'] } as Partial<Request>);
    const res = mockRes();

    await getMemories(req, res);

    expect(mockedMemoriesService.getMemories).toHaveBeenCalledWith(
      { groupId: 'g1', windowDays: 3, limitPerYear: 12 },
      { userId: 'user-1', userGroups: ['g1'] }
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: emptyResult }));
  });

  it('defaults the window and the per-year cap when they are not given', async () => {
    await getMemories(baseReq(), mockRes());
    expect(mockedMemoriesService.getMemories).toHaveBeenCalledWith(
      { groupId: undefined, windowDays: 3, limitPerYear: 12 },
      { userId: 'user-1', userGroups: [] }
    );
  });

  it('clamps a window and a cap the caller does not pay for', async () => {
    await getMemories(baseReq({ query: { windowDays: '400', limitPerYear: '0' } }), mockRes());
    expect(mockedMemoriesService.getMemories).toHaveBeenCalledWith(
      expect.objectContaining({ windowDays: 30, limitPerYear: 1 }),
      expect.anything()
    );
  });

  it('ignores an unparseable window rather than sending NaN to the query', async () => {
    await getMemories(baseReq({ query: { windowDays: 'yesterday' } }), mockRes());
    expect(mockedMemoriesService.getMemories).toHaveBeenCalledWith(
      expect.objectContaining({ windowDays: 3 }),
      expect.anything()
    );
  });
});
