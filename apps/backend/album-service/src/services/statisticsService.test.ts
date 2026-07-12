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

function distinctable(ids: string[] = []) {
  return { distinct: jest.fn().mockResolvedValue(ids) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedAlbumFind.mockReturnValue(distinctable([]));
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
    mockedAlbumFind.mockReturnValue(distinctable(['a1']));
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
      .mockResolvedValueOnce([]) // album creation stats
      .mockResolvedValueOnce([]) // popular tags
      .mockResolvedValueOnce([{ _id: 'personal', albumCount: 3, photoCount: 0 }]); // group stats
    mockedPhotoAggregate
      .mockResolvedValueOnce([{ totalSize: 1000, avgSize: 500 }]) // storage stats
      .mockResolvedValueOnce([]) // photo upload stats
      .mockResolvedValueOnce([{ totalPhotos: 2, analyzedPhotos: 1, totalDetections: 3, totalMasks: 0 }]); // ai stats

    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(result.overview.totalStorage).toBe(1000);
    expect(result.overview.averagePhotoSize).toBe(500);
    expect(result.aiAnalysis).toMatchObject({ totalPhotos: 2, analyzedPhotos: 1, analysisRate: 50 });
    expect(result.groups).toEqual([{ groupId: 'personal', albumCount: 3, photoCount: 0 }]);
  });

  it('formats time-series and tag data, and defaults an empty analysisRate when there are no photos', async () => {
    mockedAlbumAggregate.mockResolvedValueOnce([{ _id: { year: 2026, month: 3 }, count: 4 }]).mockResolvedValueOnce([
      { _id: 'vacation', count: 5 }
    ]).mockResolvedValueOnce([]);
    mockedPhotoAggregate.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await statisticsService.getAlbumStatistics({}, { userId: 'u1', userGroups: [] });

    expect(result.timeSeries.albumsCreated).toEqual([{ date: '2026-03', count: 4 }]);
    expect(result.tags).toEqual([{ tag: 'vacation', count: 5 }]);
    expect(result.aiAnalysis.analysisRate).toBe(0);
  });
});
