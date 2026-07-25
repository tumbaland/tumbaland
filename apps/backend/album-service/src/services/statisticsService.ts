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

interface TimeSeriesRow {
  _id: { year: number; month: number };
  count: number;
}

interface TagStatRow {
  _id: string;
  count: number;
}

interface AIAnalysisStats {
  totalPhotos: number;
  analyzedPhotos: number;
  totalDetections: number;
  totalMasks: number;
}

interface GroupStatRow {
  _id: string;
  albumCount: number;
  photoCount: number;
}

interface AlbumStatisticsResult {
  overview: {
    totalAlbums: number;
    totalPhotos: number;
    totalStorage: number;
    averagePhotoSize: number;
  };
  timeSeries: {
    albumsCreated: { date: string; count: number }[];
    photosUploaded: { date: string; count: number }[];
  };
  tags: { tag: string; count: number }[];
  aiAnalysis: {
    totalPhotos: number;
    analyzedPhotos: number;
    analysisRate: number;
    totalDetections: number;
    totalMasks: number;
  };
  groups: { groupId: string; albumCount: number; photoCount: number }[];
  albums: { albumId: string; name: string; totalSize: number; photoCount: number }[];
}

class StatisticsService {
  /**
   * Get comprehensive album and photo statistics
   */
  async getAlbumStatistics(
    filter: StatisticsFilter,
    context: StatisticsContext
  ): Promise<AlbumStatisticsResult> {
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

    // Get albums created over time (last 12 months)
    const albumCreationStats = await this.getAlbumCreationStats(albumMatchQuery);

    // Get photos uploaded over time (last 12 months)
    const photoUploadStats = await this.getPhotoUploadStats(photoMatchQuery);

    // Get popular tags (top 10)
    const tagStats = await this.getPopularTags(albumMatchQuery);

    // Get AI analysis statistics
    const aiStats = await this.getAIAnalysisStats(photoMatchQuery);

    // Get albums by group (if no specific group filter)
    let groupStats: GroupStatRow[] = [];
    if (!groupId) {
      groupStats = await this.getGroupStats(userId);
    }

    // Format time series data
    const formatTimeSeries = (stats: TimeSeriesRow[]) => {
      return stats.map(stat => ({
        date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}`,
        count: stat.count
      }));
    };

    return {
      overview: {
        totalAlbums: albumCount,
        totalPhotos: photoCount,
        totalStorage: storageStats.totalSize,
        averagePhotoSize: Math.round(storageStats.avgSize || 0)
      },
      timeSeries: {
        albumsCreated: formatTimeSeries(albumCreationStats),
        photosUploaded: formatTimeSeries(photoUploadStats)
      },
      tags: tagStats.map(tag => ({
        tag: tag._id,
        count: tag.count
      })),
      aiAnalysis: {
        totalPhotos: aiStats.totalPhotos,
        analyzedPhotos: aiStats.analyzedPhotos,
        analysisRate: aiStats.totalPhotos > 0 ? (aiStats.analyzedPhotos / aiStats.totalPhotos) * 100 : 0,
        totalDetections: aiStats.totalDetections,
        totalMasks: aiStats.totalMasks
      },
      groups: groupStats.map(group => ({
        groupId: group._id,
        albumCount: group.albumCount,
        photoCount: group.photoCount
      })),
      albums: topAlbums.map(album => ({
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

  /**
   * Private helper: Get album creation statistics (12 months)
   */
  private async getAlbumCreationStats(albumMatchQuery: AlbumMatchQuery): Promise<TimeSeriesRow[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    return Album.aggregate<TimeSeriesRow>([
      { $match: { ...albumMatchQuery, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
  }

  /**
   * Private helper: Get photo upload statistics (12 months)
   */
  private async getPhotoUploadStats(photoMatchQuery: PhotoMatchQuery): Promise<TimeSeriesRow[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    return Photo.aggregate<TimeSeriesRow>([
      { $match: { ...photoMatchQuery, createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
  }

  /**
   * Private helper: Get popular tags (top 10)
   */
  private async getPopularTags(albumMatchQuery: AlbumMatchQuery): Promise<TagStatRow[]> {
    return Album.aggregate<TagStatRow>([
      { $match: albumMatchQuery },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
  }

  /**
   * Private helper: Get AI analysis statistics
   */
  private async getAIAnalysisStats(photoMatchQuery: PhotoMatchQuery): Promise<AIAnalysisStats> {
    const aiAnalysisStats = await Photo.aggregate<AIAnalysisStats>([
      { $match: photoMatchQuery },
      {
        $group: {
          _id: null,
          totalPhotos: { $sum: 1 },
          analyzedPhotos: {
            $sum: {
              $cond: [
                { $or: ['$aiAnalysis.objectDetection', '$aiAnalysis.segmentation'] },
                1,
                0
              ]
            }
          },
          totalDetections: { $sum: { $ifNull: ['$aiAnalysis.objectDetection.totalDetections', 0] } },
          totalMasks: { $sum: { $ifNull: ['$aiAnalysis.segmentation.totalMasks', 0] } }
        }
      }
    ]);

    return aiAnalysisStats[0] || {
      totalPhotos: 0,
      analyzedPhotos: 0,
      totalDetections: 0,
      totalMasks: 0
    };
  }

  /**
   * Private helper: Get group statistics
   */
  private async getGroupStats(userId: string): Promise<GroupStatRow[]> {
    const groupStats = await Album.aggregate<GroupStatRow>([
      { $match: { userId } },
      {
        $group: {
          _id: { $ifNull: ['$groupId', 'personal'] },
          albumCount: { $sum: 1 },
          photoCount: { $sum: 0 }
        }
      }
    ]);

    // Get photo counts for each group
    for (const group of groupStats) {
      const groupPhotoQuery =
        group._id === 'personal'
          ? { albumId: { $in: (await Album.find({ userId, groupId: { $exists: false } }).distinct('_id')).map((albumId) => albumId.toString()) } }
          : { albumId: { $in: (await Album.find({ groupId: group._id }).distinct('_id')).map((albumId) => albumId.toString()) } };

      const photoCount = await Photo.countDocuments(groupPhotoQuery);
      group.photoCount = photoCount;
    }

    return groupStats;
  }
}

export default new StatisticsService();
