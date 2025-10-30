import { Request, Response } from 'express';
import Album from '../models/Album';
import Photo from '../models/Photo';
import mongoose from 'mongoose';

// Get album statistics for dashboard
export const getAlbumStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const { groupId, tenantId } = req.query;

    // Build base query for filtering
    let albumMatchQuery: any = {};
    let photoMatchQuery: any = {};

    if (groupId) {
      // Filter by specific group
      if (!userGroups.includes(groupId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied: Not a member of this group'
        });
        return;
      }
      albumMatchQuery.groupId = groupId as string;
      photoMatchQuery.albumId = {
        $in: await Album.find({ groupId: groupId as string }).distinct('_id')
      };
    } else {
      // No group specified: show personal albums only
      albumMatchQuery.userId = user.id;
      albumMatchQuery.groupId = { $exists: false };
      photoMatchQuery.albumId = {
        $in: await Album.find({ userId: user.id, groupId: { $exists: false } }).distinct('_id')
      };
    }

    // Get basic counts
    const [albumCount, photoCount] = await Promise.all([
      Album.countDocuments(albumMatchQuery),
      Photo.countDocuments(photoMatchQuery)
    ]);

    // Get storage usage (sum of photo sizes)
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

    const storageStats = storageResult[0] || { totalSize: 0, avgSize: 0 };

    // Get albums created over time (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const albumCreationStats = await Album.aggregate([
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

    // Get photos uploaded over time (last 12 months)
    const photoUploadStats = await Photo.aggregate([
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

    // Get popular tags (top 10)
    const tagStats = await Album.aggregate([
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

    // Get AI analysis statistics
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

    const aiStats = aiAnalysisStats[0] || {
      totalPhotos: 0,
      analyzedPhotos: 0,
      totalDetections: 0,
      totalMasks: 0
    };

    // Get albums by group (if no specific group filter)
    let groupStats = [];
    if (!groupId) {
      groupStats = await Album.aggregate([
        { $match: { userId: user.id } },
        {
          $group: {
            _id: { $ifNull: ['$groupId', 'personal'] },
            albumCount: { $sum: 1 },
            photoCount: { $sum: 0 } // Will be populated below
          }
        }
      ]);

      // Get photo counts for each group
      for (const group of groupStats) {
        const groupPhotoQuery = group._id === 'personal'
          ? { albumId: { $in: await Album.find({ userId: user.id, groupId: { $exists: false } }).distinct('_id') } }
          : { albumId: { $in: await Album.find({ groupId: group._id }).distinct('_id') } };

        const photoCount = await Photo.countDocuments(groupPhotoQuery);
        group.photoCount = photoCount;
      }
    }

    // Format time series data
    const formatTimeSeries = (stats: any[]) => {
      return stats.map(stat => ({
        date: `${stat._id.year}-${String(stat._id.month).padStart(2, '0')}`,
        count: stat.count
      }));
    };

    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    console.error('Error fetching album statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch album statistics'
    });
  }
};