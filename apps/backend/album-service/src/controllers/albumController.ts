import { Request, Response } from 'express';
import Album from '../models/Album';
import Photo from '../models/Photo';
import { deleteFile, getFileUrl, getSignedUrl } from '../services/fileService';
import { buildAccessQuery, canAccessResource } from '../utils/permissionUtils';

// Create a new album
export const createAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, isPublic = false, tags = [], groupId } = req.body;
    const user = (req as any).user;

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Album name is required'
      });
      return;
    }

    const album = new Album({
      name: name.trim(),
      description: description?.trim(),
      isPublic,
      tags: tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0),
      userId: user.id,
      groupId: groupId || undefined
    });

    const savedAlbum = await album.save();

    res.status(201).json({
      success: true,
      message: 'Album created successfully',
      data: savedAlbum
    });
  } catch (error) {
    console.error('Error creating album:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create album'
    });
  }
};

// Get all albums
export const getAlbums = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, isPublic, groupId } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    let query: any = {};
    
    // Build base query
    if (search) {
      query.$text = { $search: search as string };
    }
    if (isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    }

    // Apply permission filtering
    if (groupId) {
      // If groupId is specified, filter by group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        res.status(403).json({
          success: false,
          message: 'Access denied: Not a member of this group'
        });
        return;
      }
      query.groupId = groupId as string;
    } else {
      // No groupId specified: show only personal albums (no group)
      query.userId = user.id;
      query.groupId = { $exists: false };
    }

    const albums = await Album.find(query)
      .sort({ updatedAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Album.countDocuments(query);

    // Get photo count and cover photo data for each album
    const albumsWithCounts = await Promise.all(
      albums.map(async (album) => {
        const photoCount = await Photo.countDocuments({ albumId: album._id });
        let coverPhoto = null;
        if (album.coverPhotoId) {
          try {
            const coverPhotoDoc = await Photo.findById(album.coverPhotoId);
            if (coverPhotoDoc) {
              const fileUrl = await getSignedUrl(coverPhotoDoc.fileId);
              coverPhoto = {
                ...coverPhotoDoc.toObject(),
                signedUrl: fileUrl
              };
            }
          } catch (error) {
            console.error(`Failed to get cover photo for album ${album._id}:`, error);
          }
        }

        return {
          ...album.toObject(),
          photoCount,
          coverPhoto
        };
      })
    );

    res.json({
      success: true,
      data: {
        albums: albumsWithCounts,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching albums:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch albums'
    });
  }
};

// Get album by ID
export const getAlbumById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const album = await Album.findById(id);

    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Check if user can access this album
    const userGroups = (req as any).userGroups || [];
    const hasAccess = canAccessResource(
      user.id,
      album.userId,
      album.groupId,
      userGroups,
      album.isPublic
    );

    if (!hasAccess && !album.isPublic) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const photoCount = await Photo.countDocuments({ albumId: id });
    let coverPhoto = null;
    if (album.coverPhotoId) {
      try {
        const coverPhotoDoc = await Photo.findById(album.coverPhotoId);
        if (coverPhotoDoc) {
          const fileUrl = await getSignedUrl(coverPhotoDoc.fileId);
          coverPhoto = {
            ...coverPhotoDoc.toObject(),
            signedUrl: fileUrl
          };
        }
      } catch (error) {
        console.error(`Failed to get cover photo for album ${id}:`, error);
      }
    }

    res.json({
      success: true,
      data: {
        ...album.toObject(),
        photoCount,
        coverPhoto
      }
    });
  } catch (error) {
    console.error('Error fetching album:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch album'
    });
  }
};

// Update album
export const updateAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, isPublic, tags, coverPhotoId, groupId } = req.body;
    const user = (req as any).user;

    const album = await Album.findById(id);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Check if user can modify this album
    const userGroups = (req as any).userGroups || [];
    const hasAccess = canAccessResource(
      user.id,
      album.userId,
      album.groupId,
      userGroups,
      album.isPublic
    );

    if (!hasAccess) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim();
    if (isPublic !== undefined) updateData.isPublic = isPublic;
    if (tags) updateData.tags = tags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
    if (coverPhotoId !== undefined) updateData.coverPhotoId = coverPhotoId;
    if (groupId !== undefined) updateData.groupId = groupId;

    const updatedAlbum = await Album.findByIdAndUpdate(id, updateData, { new: true });

    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Album updated successfully',
      data: updatedAlbum
    });
  } catch (error) {
    console.error('Error updating album:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update album'
    });
  }
};

// Delete album
export const deleteAlbum = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const album = await Album.findById(id);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Get all photos in the album
    const photos = await Photo.find({ albumId: id }); // Delete all photos and associated files
    for (const photo of photos) {
      try {
        await deleteFile(photo.fileId);
      } catch (error) {
        console.error(`Failed to delete file ${photo.fileId}:`, error);
      }
    }

    // Delete all photos from database
    await Photo.deleteMany({ albumId: id });

    // Delete the album
    await Album.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Album and all photos deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting album:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete album'
    });
  }
};

// Set cover photo for album
export const setCoverPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { photoId } = req.body;

    if (!photoId) {
      res.status(400).json({
        success: false,
        message: 'Photo ID is required'
      });
      return;
    }

    // Check if album exists
    const album = await Album.findById(id);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Check if photo exists and belongs to the album
    const photo = await Photo.findOne({ _id: photoId, albumId: id });
    if (!photo) {
      res.status(404).json({
        success: false,
        message: 'Photo not found in this album'
      });
      return;
    }

    // Update album cover photo
    album.coverPhotoId = photoId;
    await album.save();

    res.json({
      success: true,
      message: 'Cover photo set successfully',
      data: album
    });
  } catch (error) {
    console.error('Error setting cover photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set cover photo'
    });
  }
};

// Remove cover photo from album
export const removeCoverPhoto = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if album exists
    const album = await Album.findById(id);
    if (!album) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    // Remove cover photo
    album.coverPhotoId = undefined;
    await album.save();

    res.json({
      success: true,
      message: 'Cover photo removed successfully',
      data: album
    });
  } catch (error) {
    console.error('Error removing cover photo:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove cover photo'
    });
  }
};
