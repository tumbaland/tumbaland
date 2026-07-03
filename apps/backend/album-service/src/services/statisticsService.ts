import Album from '../models/Album';
import Photo from '../models/Photo';
import { ForbiddenError } from '@tumbaland/core';

export interface StatisticsFilter {
  groupId?: string;
}

export interface StatisticsContext {
  userId: string;
  userGroups: string[];
}

class StatisticsService {
  /**
   * Get comprehensive album and photo statistics
   */
  async getAlbumStatistics(
    filter: StatisticsFilter,
    context: StatisticsContext
  ): Promise<any> {
    const { groupId } = filter;
    const { userId, userGroups } = context;

    // Build base query for filtering
    const albumMatchQuery: any = {};
    const photoMatchQuery: any = {};

    if (groupId) {
      // Filter by specific group
      if (!userGroups.includes(groupId)) {
        throw new ForbiddenError('Access denied: Not a member of this group');
      }
      albumMatchQuery.groupId = groupId;
      photoMatchQuery.albumId = {
        $in: await Album.find({ groupId }).distinct('_id')
      };
    } else {
      // No group specified: show personal albums only
      albumMatchQuery.userId = userId;
      albumMatchQuery.groupId = { $exists: false };
      photoMatchQuery.albumId = {
        $in: await Album.find({ userId, groupId: { $exists: false } }).distinct('_id')
      };
    }

    // Get basic counts
    const [albumCount, photoCount] = await Promise.all([
      Album.countDocuments(albumMatchQuery),
      Photo.countDocuments(photoMatchQuery)
    ]);

    // Get storage usage (sum of photo sizes)
    const storageStats = await this.getStorageStats(photoMatchQuery);

    // Get albums created over time (last 12 months)
    const albumCreationStats = await this.getAlbumCreationStats(albumMatchQuery);

    // Get photos uploaded over time (last 12 months)
    const photoUploadStats = await this.getPhotoUploadStats(photoMatchQuery);

    // Get popular tags (top 10)
    const tagStats = await this.getPopularTags(albumMatchQuery);

    // Get AI analysis statistics
    const aiStats = await this.getAIAnalysisStats(photoMatchQuery);

    // Get albums by group (if no specific group filter)
    let groupStats = [];
    if (!groupId) {
      groupStats = await this.getGroupStats(userId);
    }

    // Format time series data
    const formatTimeSeries = (stats: any[]) => {
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
      }))
    };
  }

  /**
   * Private helper: Get storage statistics
   */
  private async getStorageStats(photoMatchQuery: any): Promise<any> {
    const storageResult = await Photo.aggregate([
      { $match: photoMatchQuery },
      {
        $group: {
          _id: null,
          totalSize: { $sum: '$size' },
          avgSize: { $avg: '$size' }
        }
      }
    ]);

    return storageResult[0] || { totalSize: 0, avgSize: 0 };
  }

  /**
   * Private helper: Get album creation statistics (12 months)
   */
  private async getAlbumCreationStats(albumMatchQuery: any): Promise<any[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    return Album.aggregate([
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
  private async getPhotoUploadStats(photoMatchQuery: any): Promise<any[]> {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    return Photo.aggregate([
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
  private async getPopularTags(albumMatchQuery: any): Promise<any[]> {
    return Album.aggregate([
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
  private async getAIAnalysisStats(photoMatchQuery: any): Promise<any> {
    const aiAnalysisStats = await Photo.aggregate([
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
  private async getGroupStats(userId: string): Promise<any[]> {
    const groupStats = await Album.aggregate([
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
