import { Request, Response } from 'express';
import Photo from '../models/Photo';
import Album from '../models/Album';
import { deleteFile, getSignedUrl, getFileUploadSignedUrl } from '../services/fileService';

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
    const { page = 1, limit = 20, search } = req.query;

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
    }

    const photos = await Photo.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Photo.countDocuments(query);    // Get signed URLs for photos
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
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
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
    }    try {
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
    }    // Delete file from file service
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
    }    // Get upload signed URL from file service
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
