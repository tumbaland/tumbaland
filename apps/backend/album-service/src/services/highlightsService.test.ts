jest.mock('../models/Album', () => ({
  __esModule: true,
  default: { find: jest.fn() }
}));

jest.mock('../models/Photo', () => ({
  __esModule: true,
  default: { aggregate: jest.fn(), find: jest.fn() }
}));

jest.mock('./photoService', () => ({
  __esModule: true,
  default: { attachSignedUrls: jest.fn() }
}));

import { Types } from 'mongoose';
import Album from '../models/Album';
import Photo from '../models/Photo';
import photoService from '../services/photoService';
import highlightsService from './highlightsService';

const mockedAlbumFind = Album.find as unknown as jest.Mock;
const mockedPhotoAggregate = Photo.aggregate as unknown as jest.Mock;
const mockedPhotoFind = Photo.find as unknown as jest.Mock;
const mockedAttachSignedUrls = photoService.attachSignedUrls as jest.Mock;

// A real 24-hex id: the random pipeline casts album ids to ObjectId, so a
// fixture that is not a valid id would fail construction, not the assertion.
const ALBUM_ID = '68b7c1e2f3a4b5c6d7e8f900';

/** Album.find(...).select(...).lean() */
function albumFindStub(albums: unknown[]) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(albums)
  };
}

/** Photo.find(...).sort(...).limit(...) */
function photoFindStub(photos: unknown[]) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => void) => resolve(photos)
  };
}

const photoDoc = (over: Record<string, unknown> = {}) => ({
  _id: 'p1',
  albumId: ALBUM_ID,
  filename: 'beach.jpg',
  createdAt: new Date('2026-09-04T08:00:00.000Z'),
  metadata: { dateTaken: new Date('2024-07-03T18:20:00.000Z') },
  ...over
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedAlbumFind.mockReturnValue(albumFindStub([{ _id: ALBUM_ID, name: 'Trip' }]));
  mockedAttachSignedUrls.mockImplementation(async (photos: unknown[]) => photos);
  mockedPhotoAggregate.mockResolvedValue([]);
});

describe('getRecentPhotos', () => {
  it('returns the newest uploads first, capped at the requested limit', async () => {
    const stub = photoFindStub([photoDoc()]);
    mockedPhotoFind.mockReturnValue(stub);

    const result = await highlightsService.getRecentPhotos({ limit: 4 }, { userId: 'u1', userGroups: [] });

    expect(stub.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(stub.limit).toHaveBeenCalledWith(4);
    expect(result.photos).toHaveLength(1);
  });

  it('names the album each photo came from', async () => {
    mockedPhotoFind.mockReturnValue(photoFindStub([photoDoc()]));

    const result = await highlightsService.getRecentPhotos({}, { userId: 'u1', userGroups: [] });

    expect(result.photos[0].albumName).toBe('Trip');
  });

  it('falls back to "Unknown album" rather than dropping a photo from an album it cannot name', async () => {
    mockedPhotoFind.mockReturnValue(photoFindStub([photoDoc({ albumId: 'some-other-album' })]));

    const result = await highlightsService.getRecentPhotos({}, { userId: 'u1', userGroups: [] });

    expect(result.photos[0].albumName).toBe('Unknown album');
  });

  it('dates a photo by its capture date when it has one, and says so', async () => {
    mockedPhotoFind.mockReturnValue(photoFindStub([photoDoc()]));

    const result = await highlightsService.getRecentPhotos({}, { userId: 'u1', userGroups: [] });

    expect(result.photos[0].dateSource).toBe('taken');
    expect(result.photos[0].takenAt).toBe('2024-07-03T18:20:00.000Z');
  });

  it('falls back to the upload date, and says that instead of claiming a capture date', async () => {
    mockedPhotoFind.mockReturnValue(photoFindStub([photoDoc({ metadata: undefined })]));

    const result = await highlightsService.getRecentPhotos({}, { userId: 'u1', userGroups: [] });

    expect(result.photos[0].dateSource).toBe('uploaded');
    expect(result.photos[0].takenAt).toBe('2026-09-04T08:00:00.000Z');
  });

  it('returns nothing, and asks for no photos, when there are no albums in scope', async () => {
    mockedAlbumFind.mockReturnValue(albumFindStub([]));

    const result = await highlightsService.getRecentPhotos({}, { userId: 'u1', userGroups: [] });

    expect(result.photos).toEqual([]);
    expect(mockedPhotoFind).not.toHaveBeenCalled();
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      highlightsService.getRecentPhotos({ groupId: 'g1' }, { userId: 'u1', userGroups: [] })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('scopes to the group when the caller is a member', async () => {
    mockedPhotoFind.mockReturnValue(photoFindStub([]));

    await highlightsService.getRecentPhotos({ groupId: 'g1' }, { userId: 'u1', userGroups: ['g1'] });

    expect(mockedAlbumFind).toHaveBeenCalledWith({ groupId: 'g1' });
  });

  it('scopes to the caller’s own non-group albums otherwise', async () => {
    mockedPhotoFind.mockReturnValue(photoFindStub([]));

    await highlightsService.getRecentPhotos({}, { userId: 'u1', userGroups: ['g1'] });

    expect(mockedAlbumFind).toHaveBeenCalledWith({ userId: 'u1', groupId: { $exists: false } });
  });
});

describe('getRandomPhotos', () => {
  it('samples rather than counting and skipping, so cost does not grow with the library', async () => {
    mockedPhotoAggregate.mockResolvedValue([{ _id: new Types.ObjectId() }]);
    mockedPhotoFind.mockResolvedValue([photoDoc()]);

    const result = await highlightsService.getRandomPhotos({ limit: 1 }, { userId: 'u1', userGroups: [] });

    const pipeline = mockedPhotoAggregate.mock.calls[0][0];
    expect(pipeline).toContainEqual({ $sample: { size: 1 } });
    expect(pipeline.some((stage: Record<string, unknown>) => '$skip' in stage)).toBe(false);
    expect(result.photos).toHaveLength(1);
  });

  it('matches album ids as ObjectIds, which an aggregation will not cast for us', async () => {
    mockedPhotoAggregate.mockResolvedValue([]);

    await highlightsService.getRandomPhotos({}, { userId: 'u1', userGroups: [] });

    const [match] = mockedPhotoAggregate.mock.calls[0][0];
    expect(match.$match.albumId.$in[0]).toBeInstanceOf(Types.ObjectId);
  });

  it('returns nothing when the sample comes back empty', async () => {
    mockedPhotoAggregate.mockResolvedValue([]);

    const result = await highlightsService.getRandomPhotos({}, { userId: 'u1', userGroups: [] });

    expect(result.photos).toEqual([]);
    expect(mockedPhotoFind).not.toHaveBeenCalled();
  });

  it('refuses a group the caller does not belong to', async () => {
    await expect(
      highlightsService.getRandomPhotos({ groupId: 'g1' }, { userId: 'u1', userGroups: [] })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });
});
