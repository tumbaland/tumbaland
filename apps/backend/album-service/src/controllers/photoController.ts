import { Request, Response } from 'express';
import Photo from '../models/Photo';
import Album from '../models/Album';
import { deleteFile, getFileUrl, getFileUploadSignedUrl, getSignedUrl } from '../services/fileService';

// Create a new photo record (after file upload)
export const createPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      filename,
      originalName,
      fileId,
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

    // Validate required fields
    if (!filename || !originalName || !fileId || !albumId || !mimetype || !size) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: filename, originalName, fileId, albumId, mimetype, size'
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

    // Check if photo with this fileId already exists
    const existingPhoto = await Photo.findOne({ fileId });
    if (existingPhoto) {
      res.status(409).json({
        success: false,
        message: 'Photo with this file ID already exists'
      });
      return;
    }

    const photo = new Photo({
      filename,
      originalName,
      fileId,
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

    // If this is the first photo in the album and no cover is set, make it the cover
    if (!album.coverPhotoId) {
      album.coverPhotoId = (savedPhoto._id as string).toString();
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
    const total = await Photo.countDocuments(query); // Get signed URLs for photos
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        try {
          const signedUrl = await getSignedUrl(photo.fileId);
          return {
            ...photo.toObject(),
            signedUrl
          };
        } catch (error) {
          console.error(`Failed to get signed URL for photo ${photo._id}:`, error);
          return photo.toObject();
        }
      })
    );
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
      const signedUrl = await getSignedUrl(photo.fileId);
      res.json({
        success: true,
        data: {
          ...photo.toObject(),
          signedUrl
        }
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
    } // Delete file from file service
    try {
      await deleteFile(photo.fileId);
    } catch (error) {
      console.error(`Failed to delete file ${photo.fileId}:`, error);
    }

    // Check if this photo is the cover photo of any album
    const album = await Album.findOne({ coverPhotoId: photo._id });
    if (album) {
      // Find another photo in the same album to set as cover
      const anotherPhoto = await Photo.findOne({
        albumId: photo.albumId,
        _id: { $ne: photo._id }
      });

      album.coverPhotoId = anotherPhoto ? (anotherPhoto._id as string).toString() : undefined;
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
    } // Get upload signed URL from file service
    const { url, fileId } = await getFileUploadSignedUrl(filename, mimetype);

    res.json({
      success: true,
      data: {
        uploadUrl: url,
        fileId,
        albumId
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

// Get photo by fileId (for file service integration)
export const getPhotoByFileId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileId } = req.params;

    const photo = await Photo.findOne({ fileId });

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
    console.error('Error fetching photo by fileId:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch photo'
    });
  }
};
