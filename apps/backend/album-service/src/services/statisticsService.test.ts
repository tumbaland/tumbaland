jest.mock('../models/Album', () => ({
  __esModule: true,
  default: { find: jest.fn(), countDocuments: jest.fn(), aggregate: jest.fn() }
}));

jest.mock('../models/Photo', () => ({
  __esModule: true,
  default: { countDocuments: jest.fn(), aggregate: jest.fn() }
}));

import Album from '../models/Album';
import Photo from '../models/Photo';
import statisticsService from './statisticsService';

const mockedAlbumFind = Album.find as unknown as jest.Mock;
const mockedAlbumCount = Album.countDocuments as unknown as jest.Mock;
const mockedAlbumAggregate = Album.aggregate as unknown as jest.Mock;
const mockedPhotoCount = Photo.countDocuments as unknown as jest.Mock;
const mockedPhotoAggregate = Photo.aggregate as unknown as jest.Mock;

// Album.find() serves two different call shapes in statisticsService:
// `.distinct('_id')` (resolving photoMatchQuery's albumId list) and
// `.select().sort().limit().lean()` (getTopAlbumsByStorage). This stub
// supports both so the same default works regardless of which call site
// a given test doesn't care about.
function albumFindStub(result: unknown[] = []) {
  return {
    distinct: jest.fn().mockResolvedValue(result),
    select: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result)
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAlbumFind.mockReturnValue(albumFindStub([]));
  mockedAlbumCount.mockResolvedValue(0);
  mockedPhotoCount.mockResolvedValue(0);
  mockedAlbumAggregate.mockResolvedValue([]);
  mockedPhotoAggregate.mockResolvedValue([]);
});

describe('getAlbumStatistics', () => {
  it('throws ForbiddenError when filtering by a group the user is not a member of', async () => {
    await expect(
      statisticsService.getAlbumStatistics({ groupId: 'g1' }, { userId: 'u1', userGroups: [] })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('scopes to a group the user belongs to', async () => {
    mockedAlbumFind.mockReturnValue(albumFindStub(['a1']));
    mockedAlbumCount.mockResolvedValue(2);
    mockedPhotoCount.mockResolvedValue(5);

    const result = await statisticsService.getAlbumStatistics(
      { groupId: 'g1' },
      { userId: 'u1', userGroups: ['g1'] }
    );

    expect(result.overview.totalAlbums).toBe(2);
    expect(result.overview.totalPhotos).toBe(5);
    // Group-scoped requests skip the per-user group breakdown.
    expect(result.groups).toEqual([]);
  });

  it('scopes to personal albums and includes group stats when no groupId is given', async () => {
    mockedAlbumAggregate
      .mockResolvedValueOnce([{ totalSize: 1000, totalPhotoCount: 2 }]) // storage stats
      .mockResolvedValueOnce([]) // album creation stats
      .mockResolvedValueOnce([]) // popular tags
      .mockResolvedValueOnce([{ _id: 'personal', albumCount: 3, photoCount: 0 }]); // group stats
    mockedPhotoAggregate
      .mockResolvedValueOnce([]) // photo upload stats
      .mockResolvedValueOnce([{ totalPhotos: 2, analyzedPhotos: 1, totalDetections: 3, totalMasks: 0 }]); // ai stats

    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(result.overview.totalStorage).toBe(1000);
    expect(result.overview.averagePhotoSize).toBe(500);
    expect(result.aiAnalysis).toMatchObject({ totalPhotos: 2, analyzedPhotos: 1, analysisRate: 50 });
    expect(result.groups).toEqual([{ groupId: 'personal', albumCount: 3, photoCount: 0 }]);
  });

  it('formats time-series and tag data, and defaults an empty analysisRate when there are no photos', async () => {
    mockedAlbumAggregate
      .mockResolvedValueOnce([]) // storage stats
      .mockResolvedValueOnce([{ _id: { year: 2026, month: 3 }, count: 4 }]) // album creation stats
      .mockResolvedValueOnce([{ _id: 'vacation', count: 5 }]) // popular tags
      .mockResolvedValueOnce([]); // group stats
    mockedPhotoAggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(result.timeSeries.albumsCreated).toEqual([{ date: '2026-03', count: 4 }]);
    expect(result.tags).toEqual([{ tag: 'vacation', count: 5 }]);
    expect(result.aiAnalysis.analysisRate).toBe(0);
  });

  it('returns the top albums by storage, sorted and limited via an indexed find (no photo aggregation)', async () => {
    const topAlbumsStub = albumFindStub([
      { _id: 'a1', name: 'Trip', totalSize: 5000, photoCount: 10 },
      { _id: 'a2', name: 'Wedding', totalSize: 3000, photoCount: 4 }
    ]);
    mockedAlbumFind.mockReturnValue(topAlbumsStub);

    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(topAlbumsStub.select).toHaveBeenCalledWith({ name: 1, totalSize: 1, photoCount: 1 });
    expect(topAlbumsStub.sort).toHaveBeenCalledWith({ totalSize: -1 });
    expect(topAlbumsStub.limit).toHaveBeenCalledWith(8);
    expect(result.albums).toEqual([
      { albumId: 'a1', name: 'Trip', totalSize: 5000, photoCount: 10 },
      { albumId: 'a2', name: 'Wedding', totalSize: 3000, photoCount: 4 }
    ]);
  });
});
