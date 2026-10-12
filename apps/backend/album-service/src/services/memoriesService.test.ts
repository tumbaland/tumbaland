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
import memoriesService, { localToday, windowMonthDays } from './memoriesService';

const mockedAlbumFind = Album.find as unknown as jest.Mock;
const mockedPhotoAggregate = Photo.aggregate as unknown as jest.Mock;
const mockedPhotoFind = Photo.find as unknown as jest.Mock;
const mockedAttachSignedUrls = photoService.attachSignedUrls as jest.Mock;

const NOW = new Date('2026-09-03T10:15:00.000Z');

// A real 24-hex id: the pipeline casts album ids to ObjectId, so a fixture that
// is not a valid id would fail construction rather than the assertion.
const ALBUM_ID = '68b7c1e2f3a4b5c6d7e8f900';

/** Album.find(...).select(...).lean() */
function albumFindStub(albums: unknown[]) {
  return {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(albums)
  };
}

const photoDoc = (over: Record<string, unknown> = {}) => ({
  _id: 'p1',
  albumId: ALBUM_ID,
  filename: 'beach.jpg',
  createdAt: new Date('2024-09-04T08:00:00.000Z'),
  metadata: { dateTaken: new Date('2024-09-03T18:20:00.000Z') },
  ...over
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedAlbumFind.mockReturnValue(albumFindStub([{ _id: ALBUM_ID, name: 'Summer' }]));
  mockedPhotoAggregate.mockResolvedValue([]);
  mockedPhotoFind.mockResolvedValue([]);
  mockedAttachSignedUrls.mockImplementation(async (photos: unknown[]) => photos);
});

describe('windowMonthDays', () => {
  it('covers the day itself when the window is zero', () => {
    expect(windowMonthDays(NOW, 0)).toEqual([{ month: 9, day: 3 }]);
  });

  it('reaches back into the previous month at a month boundary', () => {
    const days = windowMonthDays(new Date('2026-01-01T00:00:00.000Z'), 2);
    expect(days).toEqual([
      { month: 12, day: 30 },
      { month: 12, day: 31 },
      { month: 1, day: 1 },
      { month: 1, day: 2 },
      { month: 1, day: 3 }
    ]);
  });

  it('includes 29 February, so a leap-day photo is reachable', () => {
    // Walked in a leap year on purpose: in a common year the day would not exist.
    expect(windowMonthDays(new Date('2026-03-01T00:00:00.000Z'), 1)).toContainEqual({ month: 2, day: 29 });
  });
});

describe('getMemories', () => {
  it('refuses a group the caller does not belong to', async () => {
    await expect(
      memoriesService.getMemories({ groupId: 'g1', now: NOW }, { userId: 'u1', userGroups: [] })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('scopes to a group the caller belongs to', async () => {
    await memoriesService.getMemories({ groupId: 'g1', now: NOW }, { userId: 'u1', userGroups: ['g1'] });
    expect(mockedAlbumFind).toHaveBeenCalledWith({ groupId: 'g1' });
  });

  it("scopes to the caller's own non-group albums when no group is given", async () => {
    await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: ['g1'] });
    expect(mockedAlbumFind).toHaveBeenCalledWith({ userId: 'u1', groupId: { $exists: false } });
  });

  it('returns an empty result without touching photos when there are no albums', async () => {
    mockedAlbumFind.mockReturnValue(albumFindStub([]));
    const result = await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });

    expect(result).toEqual({ date: '2026-09-03', windowDays: 3, totalPhotos: 0, years: [] });
    expect(mockedPhotoAggregate).not.toHaveBeenCalled();
  });

  it('excludes the current year — this week is not a memory yet', async () => {
    await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });
    const [pipeline] = mockedPhotoAggregate.mock.calls[0];
    expect(pipeline).toContainEqual({
      $match: expect.objectContaining({ memoryYear: { $lt: 2026 } })
    });
  });

  it('matches album ids as ObjectIds, since an aggregation is never cast for us', async () => {
    await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });
    const [pipeline] = mockedPhotoAggregate.mock.calls[0];

    // Mongoose casts a query against the schema but leaves a pipeline alone, so
    // a string here would be compared to an ObjectId in the collection and match
    // nothing — the whole strip would come back empty for everyone.
    const [{ $match: match }] = pipeline;
    expect(match.albumId.$in).toEqual([new Types.ObjectId(ALBUM_ID)]);
    expect(match.albumId.$in[0]).toBeInstanceOf(Types.ObjectId);
  });

  it('falls back to the upload date when a photo carries no capture date', async () => {
    await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });
    const [pipeline] = mockedPhotoAggregate.mock.calls[0];
    expect(pipeline).toContainEqual({
      $addFields: { memoryDate: { $ifNull: ['$metadata.dateTaken', '$createdAt'] } }
    });
  });

  it('caps each year at limitPerYear while reporting the true count', async () => {
    mockedPhotoAggregate.mockResolvedValue([{ _id: 2024, photoCount: 40, photoIds: ['p1'] }]);
    mockedPhotoFind.mockResolvedValue([photoDoc()]);

    const result = await memoriesService.getMemories({ now: NOW, limitPerYear: 1 }, { userId: 'u1', userGroups: [] });

    const [pipeline] = mockedPhotoAggregate.mock.calls[0];
    expect(pipeline).toContainEqual({ $project: { photoCount: 1, photoIds: { $slice: ['$photoIds', 1] } } });
    expect(result.years[0]).toMatchObject({ year: 2024, yearsAgo: 2, photoCount: 40 });
    expect(result.years[0].photos).toHaveLength(1);
    expect(result.totalPhotos).toBe(40);
  });

  it('labels each photo with its album and the date it is remembered on', async () => {
    mockedPhotoAggregate.mockResolvedValue([{ _id: 2024, photoCount: 1, photoIds: ['p1'] }]);
    mockedPhotoFind.mockResolvedValue([photoDoc()]);

    const result = await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });

    expect(result.years[0].photos[0]).toMatchObject({
      albumName: 'Summer',
      memoryDate: '2024-09-03',
      dateSource: 'taken'
    });
  });

  it('marks a photo remembered on its upload date as such', async () => {
    mockedPhotoAggregate.mockResolvedValue([{ _id: 2024, photoCount: 1, photoIds: ['p1'] }]);
    mockedPhotoFind.mockResolvedValue([photoDoc({ metadata: undefined })]);

    const result = await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });

    expect(result.years[0].photos[0]).toMatchObject({ memoryDate: '2024-09-04', dateSource: 'uploaded' });
  });

  it('keeps the aggregation ordering, which find() does not preserve', async () => {
    mockedPhotoAggregate.mockResolvedValue([{ _id: 2024, photoCount: 2, photoIds: ['p2', 'p1'] }]);
    // Deliberately returned in the other order, as an index-ordered find would.
    mockedPhotoFind.mockResolvedValue([photoDoc({ _id: 'p1' }), photoDoc({ _id: 'p2' })]);

    const result = await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });

    expect(result.years[0].photos.map((photo) => photo._id)).toEqual(['p2', 'p1']);
  });

  it('drops an id the follow-up find did not return', async () => {
    mockedPhotoAggregate.mockResolvedValue([{ _id: 2024, photoCount: 2, photoIds: ['p1', 'gone'] }]);
    mockedPhotoFind.mockResolvedValue([photoDoc()]);

    const result = await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });

    expect(result.years[0].photos).toHaveLength(1);
  });

  it("signs every year's photos in a single batch", async () => {
    mockedPhotoAggregate.mockResolvedValue([
      { _id: 2024, photoCount: 1, photoIds: ['p1'] },
      { _id: 2023, photoCount: 1, photoIds: ['p2'] }
    ]);
    mockedPhotoFind.mockResolvedValue([photoDoc({ _id: 'p1' }), photoDoc({ _id: 'p2' })]);

    const result = await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });

    expect(mockedPhotoFind).toHaveBeenCalledWith({ _id: { $in: ['p1', 'p2'] } });
    expect(mockedAttachSignedUrls).toHaveBeenCalledTimes(1);
    expect(result.years.map((year) => year.yearsAgo)).toEqual([2, 3]);
  });

  it('names an album it cannot resolve rather than dropping the photo', async () => {
    mockedPhotoAggregate.mockResolvedValue([{ _id: 2024, photoCount: 1, photoIds: ['p1'] }]);
    mockedPhotoFind.mockResolvedValue([photoDoc({ albumId: '68b7c1e2f3a4b5c6d7e8f9ff' })]);

    const result = await memoriesService.getMemories({ now: NOW }, { userId: 'u1', userGroups: [] });

    expect(result.years[0].photos[0].albumName).toBe('Unknown album');
  });
});

describe('localToday', () => {
  it('is already tomorrow in Tallinn while UTC is still on today', () => {
    // 01:30 on 4 September in Tallinn
    expect(localToday(new Date('2026-09-03T22:30:00Z')).toISOString()).toBe('2026-09-04T00:00:00.000Z');
  });

  it('is the same day in the afternoon', () => {
    expect(localToday(new Date('2026-09-03T10:15:00Z')).toISOString()).toBe('2026-09-03T00:00:00.000Z');
  });
});
