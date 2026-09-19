import Album from '../models/Album';
import Photo from '../models/Photo';
import { ForbiddenError } from '@tumbaland/backend-core';

export interface StatisticsFilter {
  groupId?: string;
}

export interface StatisticsContext {
  userId: string;
  userGroups: string[];
}

interface AlbumMatchQuery {
  groupId?: string | { $exists: false };
  userId?: string;
}

interface PhotoMatchQuery {
  albumId?: { $in: string[] };
}

interface StorageStats {
  totalSize: number;
  avgSize: number;
}

interface AlbumStorageAggRow {
  totalSize: number;
  totalPhotoCount: number;
}

interface TopAlbumRow {
  _id: unknown;
  name: string;
  totalSize: number;
  photoCount: number;
}

interface AlbumStatisticsResult {
  overview: {
    totalAlbums: number;
    totalPhotos: number;
    totalStorage: number;
    averagePhotoSize: number;
  };
  albums: { albumId: string; name: string; totalSize: number; photoCount: number }[];
}

class StatisticsService {
  /**
   * Get comprehensive album and photo statistics
   */
  async getAlbumStatistics(filter: StatisticsFilter, context: StatisticsContext): Promise<AlbumStatisticsResult> {
    const { groupId } = filter;
    const { userId, userGroups } = context;

    // Build base query for filtering
    const albumMatchQuery: AlbumMatchQuery = {};
    const photoMatchQuery: PhotoMatchQuery = {};

    if (groupId) {
      // Filter by specific group
      if (!userGroups.includes(groupId)) {
        throw new ForbiddenError('Access denied: Not a member of this group');
      }
      albumMatchQuery.groupId = groupId;
      photoMatchQuery.albumId = {
        $in: (await Album.find({ groupId }).distinct('_id')).map((id) => id.toString())
      };
    } else {
      // No group specified: show personal albums only
      albumMatchQuery.userId = userId;
      albumMatchQuery.groupId = { $exists: false };
      photoMatchQuery.albumId = {
        $in: (await Album.find({ userId, groupId: { $exists: false } }).distinct('_id')).map((id) => id.toString())
      };
    }

    // Get basic counts
    const [albumCount, photoCount] = await Promise.all([
      Album.countDocuments(albumMatchQuery),
      Photo.countDocuments(photoMatchQuery)
    ]);

    // Get storage usage. Summed from the albums' own denormalized totalSize
    // (see photoService's create/deletePhoto) rather than aggregating over
    // every matching photo — the album collection is orders of magnitude
    // smaller than the photo collection, so this scales with album count,
    // not photo count.
    const storageStats = await this.getStorageStats(albumMatchQuery);

    // Get the albums with the most storage used (top 8), for the dashboard's
    // per-album breakdown. Backed by the { userId/groupId, totalSize } index
    // on Album, so this is a fast indexed sort/limit, not a full scan.
    const topAlbums = await this.getTopAlbumsByStorage(albumMatchQuery);

    return {
      overview: {
        totalAlbums: albumCount,
        totalPhotos: photoCount,
        totalStorage: storageStats.totalSize,
        averagePhotoSize: Math.round(storageStats.avgSize || 0)
      },
      albums: topAlbums.map((album) => ({
        albumId: String(album._id),
        name: album.name,
        totalSize: album.totalSize,
        photoCount: album.photoCount
      }))
    };
  }

  /**
   * Private helper: Get storage statistics, summed from the albums'
   * denormalized totalSize/photoCount rather than scanning every photo.
   */
  private async getStorageStats(albumMatchQuery: AlbumMatchQuery): Promise<StorageStats> {
    const storageResult = await Album.aggregate<AlbumStorageAggRow>([
      { $match: albumMatchQuery },
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$totalSize' },
          totalPhotoCount: { $sum: '$photoCount' }
        }
      }
    ]);

    const { totalSize = 0, totalPhotoCount = 0 } = storageResult[0] || {};
    return {
      totalSize,
      avgSize: totalPhotoCount > 0 ? totalSize / totalPhotoCount : 0
    };
  }

  /**
   * Private helper: Get the top N albums by storage used, for the
   * dashboard's per-album breakdown. A plain indexed find — no aggregation
   * across photos.
   *
   * Note: the $sort happens in MongoDB against whatever totalSize actually
   * has on disk, so an album that predates this field (hasn't been
   * backfilled by scripts/migration/backfill-album-storage.js) sorts as if
   * its size were 0/absent regardless of how many photos it really has —
   * that ranking can only be fixed by running the backfill, not by
   * coalescing after the fact. The .map() below only protects display
   * (so a legacy album that does make the top N doesn't render "undefined").
   */
  private async getTopAlbumsByStorage(albumMatchQuery: AlbumMatchQuery, limit = 8): Promise<TopAlbumRow[]> {
    const rows = await Album.find(albumMatchQuery)
      .select({ name: 1, totalSize: 1, photoCount: 1 })
      .sort({ totalSize: -1 })
      .limit(limit)
      .lean<TopAlbumRow[]>();

    return rows.map((row) => ({ ...row, totalSize: row.totalSize ?? 0, photoCount: row.photoCount ?? 0 }));
  }
}

export default new StatisticsService();
