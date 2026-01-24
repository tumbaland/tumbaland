import { Request, Response } from 'express';
import Photo from '../models/Photo';
import Album from '../models/Album';
import {
  deleteFile,
  deleteFolder,
  getSignedUrl,
  getPhotoSignedUrl,
  getPhotoSignedUrlsBatch,
  getUploadSignedUrl,
  generateFileId,
  getFileFolder,
  getFile,
  SignedUrlData
} from '../services/minioService';
import { generateThumbnailFromBuffer, isSupportedImageFormat } from '../services/thumbnailService';
export const createPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      filename,
      originalName,
      fileId, // Accept both fileId and minioFileId for backward compatibility
      minioFileId,
      albumId,
      title,
      description,
      mimetype,
      size,
      width,
      height,
      tags = [],
      metadata = {}
    } = req.body;

    // Use minioFileId if provided, otherwise use fileId (for backward compatibility)
    const actualMinioFileId = minioFileId || fileId;

    // Validate required fields
    if (!filename || !originalName || !actualMinioFileId || !albumId || !mimetype || !size) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, originalName, minioFileId (or fileId), albumId, mimetype, size'
      });
      return;
    }

    // Check if album exists
    const album = await Album.findById(albumId);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Check if photo with this minioFileId already exists
    if (actualMinioFileId) {
      const existingPhoto = await Photo.findOne({ minioFileId: actualMinioFileId });
      if (existingPhoto) {
        res.status(409).json({
          success: false,
          message: 'Photo with this MinIO file ID already exists'
        });
        return;
      }
    }

    const photo = new Photo({
      filename,
      originalName,
      minioFileId: actualMinioFileId,
      albumId,
      title: title?.trim(),
      description: description?.trim(),
      mimetype,
      size,
      width,
      height,
      tags: tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0),
      metadata
    });

    const savedPhoto = await photo.save();

    // Generate thumbnail asynchronously for supported image formats (don't block photo creation)
    if (isSupportedImageFormat(mimetype)) {
      try {
        // Generate thumbnail from the uploaded file
        setImmediate(async () => {
          try {
            // Download the original file from MinIO
            const imageBuffer = await getFile(actualMinioFileId);
            const userId = (req as any).user?.id;
            
            // Generate thumbnail from the buffer
            const thumbnailResult = await generateThumbnailFromBuffer(
              imageBuffer,
              originalName,
              userId,
              albumId,
              album.groupId
            );
            
            // Update photo with thumbnail file ID returned from generation
            await Photo.findByIdAndUpdate(savedPhoto._id, {
              minioThumbnailFileId: thumbnailResult.thumbnailFileId
            });
            
            console.log(`Thumbnail generated successfully for photo ${savedPhoto._id}`);
          } catch (error) {
            console.error('Failed to generate thumbnail:', error);
          }
        });
      } catch (error) {
        console.error('Failed to initiate thumbnail generation:', error);
      }
    }

    // If this is the first photo in the album and no cover is set, make it the cover
    if (!album.coverPhotoId) {
      album.coverPhotoId = savedPhoto._id.toString();
      await album.save();
    }

    res.status(201).json({
      success: true,
      message: 'Photo created successfully',
      data: savedPhoto
    });
  } catch (error) {
    console.error('Error creating photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create photo'
    });
  }
};

// Get photos by album
export const getPhotosByAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { albumId } = req.params;
    const { page = 1, limit, search } = req.query;

    // Check if album exists
    const album = await Album.findById(albumId);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }
    const query: any = { albumId };
    if (search) {
      query.$text = { $search: search as string };
    } // Handle pagination - if limit is not provided or is 0, fetch all photos
    const limitNum = limit ? Number(limit) : undefined;
    const pageNum = Number(page);

    let photosQuery = Photo.find(query).sort({ createdAt: -1 });

    if (limitNum && limitNum > 0) {
      photosQuery = photosQuery.limit(limitNum).skip((pageNum - 1) * limitNum);
    }

    const photos = await photosQuery;
    const total = await Photo.countDocuments(query);

    const fileIds = photos.map((photo) => photo.minioFileId).filter(Boolean);
    let signedUrlMap: Record<string, SignedUrlData> = {};

    try {
      signedUrlMap = await getPhotoSignedUrlsBatch(photos, false, 60);
    } catch (error) {
      console.error('Failed to fetch batch signed URLs for album photos:', error);
    }

    // Get thumbnail URLs for photos that have thumbnails
    const photosWithThumbnails = photos.filter((photo) => photo.minioThumbnailFileId);
    let thumbnailSignedUrlMap: Record<string, SignedUrlData> = {};

    if (photosWithThumbnails.length > 0) {
      try {
        thumbnailSignedUrlMap = await getPhotoSignedUrlsBatch(photosWithThumbnails, true, 60);
      } catch (error) {
        console.error('Failed to fetch batch signed URLs for thumbnails:', error);
      }
    }

    const photosWithUrls = photos.map((photo) => {
      const signedUrlData = signedUrlMap[photo.minioFileId || ''];
      const photoObj = photo.toObject();

      const result: any = { ...photoObj };

      if (signedUrlData) {
        result.signedUrl = signedUrlData.signedUrl;
        result.signedUrlExpiresAt = signedUrlData.expiresAt;
        result.signedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
      }

      // For photos with minioThumbnailFileId, try to get thumbnail signed URL
      if (photo.minioThumbnailFileId) {
        const thumbnailSignedUrlData = thumbnailSignedUrlMap[photo.minioFileId || ''];
        if (thumbnailSignedUrlData) {
          result.thumbnailSignedUrl = thumbnailSignedUrlData.signedUrl;
          result.thumbnailSignedUrlExpiresAt = thumbnailSignedUrlData.expiresAt;
          result.thumbnailSignedUrlExpiresInMinutes = thumbnailSignedUrlData.expiresInMinutes;
        }
      } else {
        // For photos without thumbnails (GIFs, videos), use original as thumbnail
        if (signedUrlData) {
          result.thumbnailSignedUrl = signedUrlData.signedUrl;
          result.thumbnailSignedUrlExpiresAt = signedUrlData.expiresAt;
          result.thumbnailSignedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
        }
      }

      // Explicitly include thumbnail photo IDs for frontend
      result.minioThumbnailFileId = photo.minioThumbnailFileId;

      return result;
    });
    res.json({
      success: true,
      data: {
        photos: photosWithUrls,
        pagination: {
          page: pageNum,
          limit: limitNum || 0,
          total,
          pages: limitNum && limitNum > 0 ? Math.ceil(total / limitNum) : 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photos'
    });
  }
};

// Get photo by ID
export const getPhotoById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id).populate('albumId');

    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
      return;
    }
    try {
      const signedUrlData = await getPhotoSignedUrl(photo, false, 60);
      const result: any = {
        ...photo.toObject()
      };

      if (signedUrlData) {
        result.signedUrl = signedUrlData.signedUrl;
        result.signedUrlExpiresAt = signedUrlData.expiresAt;
        result.signedUrlExpiresInMinutes = signedUrlData.expiresInMinutes;
      }

      // Add thumbnail URL if available
      if (photo.minioThumbnailFileId) {
        try {
          const thumbnailSignedUrlData = await getPhotoSignedUrl(photo, true, 60);
          if (thumbnailSignedUrlData) {
            result.thumbnailSignedUrl = thumbnailSignedUrlData.signedUrl;
            result.thumbnailSignedUrlExpiresAt = thumbnailSignedUrlData.expiresAt;
            result.thumbnailSignedUrlExpiresInMinutes = thumbnailSignedUrlData.expiresInMinutes;
          }
        } catch (error) {
          console.error('Failed to get thumbnail signed URL:', error);
        }
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Failed to get signed URL:', error);
      res.json({
        success: true,
        data: photo.toObject()
      });
    }
  } catch (error) {
    console.error('Error fetching photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo'
    });
  }
};

// Update photo
export const updatePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, tags, metadata } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title?.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (tags) updateData.tags = tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
    if (metadata) updateData.metadata = metadata;

    const photo = await Photo.findByIdAndUpdate(id, updateData, { new: true });

    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Photo updated successfully',
      data: photo
    });
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update photo'
    });
  }
};

// Delete photo
export const deletePhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const photo = await Photo.findById(id);
    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
      return;
    }

    // Delete file from MinIO
    try {
      // Delete the entire folder containing the photo and its thumbnail
      if (photo.minioFileId) {
        const folderPath = getFileFolder(photo.minioFileId);
        await deleteFolder(folderPath);
      }
    } catch (error) {
      console.error(`Failed to delete folder for photo ${photo.minioFileId}:`, error);
    }

    // Check if this photo is the cover photo of any album
    const album = await Album.findOne({ coverPhotoId: photo._id });
    if (album) {
      // Find another photo in the same album to set as cover
      const anotherPhoto = await Photo.findOne({
        albumId: photo.albumId,
        _id: { $ne: photo._id }
      });

      album.coverPhotoId = anotherPhoto ? anotherPhoto._id.toString() : undefined;
      await album.save();
    }

    // Delete the photo record
    await Photo.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo'
    });
  }
};

// Get upload signed URL for direct client upload
export const getUploadSignedUrlRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename, mimetype, albumId } = req.body;
    const userId = (req as any).user?.id; // From auth middleware

    if (!filename || !mimetype || !albumId) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, mimetype, albumId'
      });
      return;
    }

    // Check if album exists
    const album = await Album.findById(albumId);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Generate secure file ID (user-scoped for organization)
    const fileId = generateFileId(userId, albumId, filename, album.groupId);

    // Get upload URL directly from MinIO
    const uploadUrl = await getUploadSignedUrl(fileId, mimetype, 15);

    res.json({
      success: true,
      data: {
        uploadUrl,
        minioFileId: fileId,
        albumId,
        expiresInMinutes: 15 // URL expires in 15 minutes
      }
    });
  } catch (error) {
    console.error('Error getting upload signed URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upload signed URL'
    });
  }
};

// Update photo with AI analysis results
export const updatePhotoAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { analysisType, jobId, totalDetections, totalMasks, segmentationType, processingTime } = req.body;

    // Validate required fields
    if (!analysisType || !jobId || processingTime === undefined) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: analysisType, jobId, processingTime'
      });
      return;
    }

    // Validate analysis type
    if (!['objectDetection', 'segmentation'].includes(analysisType)) {
      res.status(400).json({
        success: false,
        message: 'Invalid analysis type. Must be "objectDetection" or "segmentation"'
      });
      return;
    }

    const photo = await Photo.findById(id);
    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
      return;
    }

    // Initialize aiAnalysis if it doesn't exist
    if (!photo.aiAnalysis) {
      photo.aiAnalysis = {};
    }

    // Update the specific analysis type
    if (analysisType === 'objectDetection') {
      photo.aiAnalysis.objectDetection = {
        jobId,
        analyzedAt: new Date(),
        totalDetections: totalDetections || 0,
        processingTime
      };
    } else if (analysisType === 'segmentation') {
      photo.aiAnalysis.segmentation = {
        jobId,
        analyzedAt: new Date(),
        totalMasks: totalMasks || 0,
        segmentationType: segmentationType || 'automatic',
        processingTime
      };
    }

    const savedPhoto = await photo.save();
    res.json({
      success: true,
      data: savedPhoto
    });
  } catch (error) {
    console.error('Error updating photo AI analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update photo AI analysis'
    });
  }
};

// Get photos that need AI analysis
export const getPhotosForAIAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { albumId } = req.params;
    const { analysisType, page = 1, limit = 20 } = req.query;

    // Validate analysis type
    if (analysisType && !['objectDetection', 'segmentation'].includes(analysisType as string)) {
      res.status(400).json({
        success: false,
        message: 'Invalid analysis type. Must be "objectDetection" or "segmentation"'
      });
      return;
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query to find photos without specific AI analysis
    let query: any = { albumId };

    if (analysisType === 'objectDetection') {
      query['aiAnalysis.objectDetection.resultId'] = { $exists: false };
    } else if (analysisType === 'segmentation') {
      query['aiAnalysis.segmentation.resultId'] = { $exists: false };
    } else {
      // Find photos without any AI analysis
      query.$or = [
        { 'aiAnalysis.objectDetection.resultId': { $exists: false } },
        { 'aiAnalysis.segmentation.resultId': { $exists: false } }
      ];
    }

    const [photos, total] = await Promise.all([
      Photo.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('albumId', 'name'),
      Photo.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: photos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error getting photos for AI analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get photos for AI analysis'
    });
  }
};

// Get photo by minioFileId (for file service integration)
export const getPhotoByFileId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;

    const photo = await Photo.findOne({ minioFileId: fileId });

    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Photo not found'
      });
      return;
    }

    res.json({
      success: true,
      data: photo
    });
  } catch (error) {
    console.error('Error fetching photo by minioFileId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo'
    });
  }
};
