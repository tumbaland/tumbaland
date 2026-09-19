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

    const result = await statisticsService.getAlbumStatistics({ groupId: 'g1' }, { userId: 'u1', userGroups: ['g1'] });

    expect(result.overview.totalAlbums).toBe(2);
    expect(result.overview.totalPhotos).toBe(5);
  });

  it('scopes to personal albums when no groupId is given', async () => {
    mockedAlbumAggregate.mockResolvedValueOnce([{ totalSize: 1000, totalPhotoCount: 2 }]); // storage stats

    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(result.overview.totalStorage).toBe(1000);
    expect(result.overview.averagePhotoSize).toBe(500);
  });

  it('returns only what the dashboard draws, so nothing is computed to be thrown away', async () => {
    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(Object.keys(result).sort()).toEqual(['albums', 'overview']);
  });

  it('runs one aggregation, the storage sum, and no per-group N+1 loop', async () => {
    await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    // The group breakdown used to issue a find plus a countDocuments per
    // group, on top of three time-series and tag aggregations, for charts
    // the dashboard no longer draws.
    expect(mockedAlbumAggregate).toHaveBeenCalledTimes(1);
    expect(mockedPhotoAggregate).not.toHaveBeenCalled();
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

  it('coalesces totalSize/photoCount to 0 for an album that predates those fields (not yet backfilled)', async () => {
    // Note: this only covers display-side coalescing. The $sort itself runs
    // in Mongo against whatever's actually on disk, so a legacy album's rank
    // among the top N is only correct once the backfill script has run —
    // see the comment on getTopAlbumsByStorage.
    mockedAlbumFind.mockReturnValue(albumFindStub([{ _id: 'legacy-album', name: 'Old Trip' }]));

    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(result.albums).toEqual([{ albumId: 'legacy-album', name: 'Old Trip', totalSize: 0, photoCount: 0 }]);
  });
});
