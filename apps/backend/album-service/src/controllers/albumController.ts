import { Request, Response } from 'express';
import Album from '../models/Album';
import Photo from '../models/Photo';
import {
  deleteFile,
  getSignedUrl,
  getSignedUrlsBatch,
  SignedUrlData
} from '../services/fileService';
import { canAccessResource } from '../utils/permissionUtils';
import mongoose from 'mongoose';

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
    const { page = 1, limit = 10, search, isPublic, groupId, includeCover } = req.query;
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const groupServiceError = (req as any).groupServiceError;

    let matchQuery: any = {};
    
    // Build base query
    if (search) {
      matchQuery.$text = { $search: search as string };
    }
    if (isPublic !== undefined) {
      matchQuery.isPublic = isPublic === 'true';
    }

    // Apply permission filtering
    if (groupId) {
      // If groupId is specified, filter by group (user must be member)
      if (!userGroups.includes(groupId as string)) {
        if (groupServiceError) {
          res.status(503).json({
            success: false,
            message: 'Group service temporarily unavailable. Please try again.'
          });
          return;
        }
        res.status(403).json({
          success: false,
          message: 'Access denied: Not a member of this group'
        });
        return;
      }
      matchQuery.groupId = groupId as string;
    } else {
      // No groupId specified: show only personal albums (no group)
      matchQuery.userId = user.id;
      matchQuery.groupId = { $exists: false };
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Use aggregation pipeline to get albums with photo counts in one query
    const aggregationPipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'photos',
          localField: '_id',
          foreignField: 'albumId',
          as: 'photos'
        }
      },
      {
        $addFields: {
          photoCount: { $size: '$photos' }
        }
      },
      {
        $project: {
          photos: 0 // Remove the photos array from result
        }
      },
      { $sort: { updatedAt: -1 as -1 } },
      { $skip: skip },
      { $limit: Number(limit) }
    ];

    // Get total count for pagination
    const totalPipeline: any[] = [
      { $match: matchQuery },
      { $count: 'total' }
    ];

    const [albumsResult, totalResult] = await Promise.all([
      (Album as any).aggregate(aggregationPipeline),
      (Album as any).aggregate(totalPipeline)
    ]);

    const total = totalResult[0]?.total || 0;

    const shouldIncludeCover = includeCover === undefined || includeCover === 'true' || includeCover === '1';

    let albumsWithCovers = albumsResult as any[];

    if (shouldIncludeCover) {
      const coverPhotoIds = Array.from(
        new Set(
          (albumsResult as any[])
            .filter((album: any) => album.coverPhotoId)
            .map((album: any) => album.coverPhotoId.toString())
        )
      );

      let coverPhotoMap = new Map<string, any>();
      if (coverPhotoIds.length > 0) {
        const coverPhotoDocs = await Photo.find({ _id: { $in: coverPhotoIds } });
        const fileIds = coverPhotoDocs.map((photo) => photo.fileId);
        let signedUrlMap: Record<string, SignedUrlData> = {};

        try {
          signedUrlMap = await getSignedUrlsBatch(fileIds);
        } catch (error) {
          console.error('Failed to fetch batch signed URLs for cover photos:', error);
        }

        coverPhotoMap = new Map(
          coverPhotoDocs.map((photo) => {
            const signedUrlData = signedUrlMap[photo.fileId];
            return [
              photo.id,
              {
                ...photo.toObject(),
                signedUrl: signedUrlData?.signedUrl || null,
                signedUrlExpiresAt: signedUrlData?.expiresAt || null,
                signedUrlExpiresInMinutes: signedUrlData?.expiresInMinutes || null
              }
            ];
          })
        );
      }

      // Combine albums with cover photos
      albumsWithCovers = (albumsResult as any[]).map((album: any) => ({
        ...album,
        coverPhoto: album.coverPhotoId ? coverPhotoMap.get(album.coverPhotoId.toString()) || null : null
      }));
    } else {
      albumsWithCovers = (albumsResult as any[]).map((album: any) => ({
        ...album,
        coverPhoto: null
      }));
    }

    res.json({
      success: true,
      data: {
        albums: albumsWithCovers,
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

    // Use aggregation to get album with photo count and cover photo in one query
    const aggregationPipeline: any[] = [
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'photos',
          let: { albumId: '$_id', coverPhotoId: '$coverPhotoId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$albumId', '$$albumId'] },
                    { $eq: ['$_id', '$$coverPhotoId'] }
                  ]
                }
              }
            }
          ],
          as: 'relatedPhotos'
        }
      },
      {
        $addFields: {
          photoCount: {
            $size: {
              $filter: {
                input: '$relatedPhotos',
                cond: { $eq: ['$$this.albumId', '$_id'] }
              }
            }
          },
          coverPhotoDoc: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$relatedPhotos',
                  cond: { $eq: ['$$this._id', '$coverPhotoId'] }
                }
              },
              0
            ]
          }
        }
      },
      {
        $project: {
          relatedPhotos: 0
        }
      }
    ];

    const albumResult = await (Album as any).aggregate(aggregationPipeline);

    if (!albumResult || albumResult.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Album not found'
      });
      return;
    }

    const albumData = albumResult[0];

    // Check if user can access this album
    const userGroups = (req as any).userGroups || [];
    const hasAccess = canAccessResource(
      user.id,
      albumData.userId,
      albumData.groupId,
      userGroups,
      albumData.isPublic
    );

    if (!hasAccess && !albumData.isPublic) {
      res.status(403).json({
        success: false,
        message: 'Access denied'
      });
      return;
    }

    // Process cover photo signed URL if exists
    let coverPhoto = null;
    if (albumData.coverPhotoDoc) {
      try {
        const signedUrlData = await getSignedUrl(albumData.coverPhotoDoc.fileId);
        if (signedUrlData) {
          coverPhoto = {
            ...albumData.coverPhotoDoc,
            signedUrl: signedUrlData.signedUrl,
            signedUrlExpiresAt: signedUrlData.expiresAt,
            signedUrlExpiresInMinutes: signedUrlData.expiresInMinutes
          };
        }
      } catch (error) {
        console.error(`Failed to get cover photo for album ${id}:`, error);
      }
    }

    // Remove the coverPhotoDoc field and add coverPhoto
    const { coverPhotoDoc, ...albumResponse } = albumData;

    res.json({
      success: true,
      data: {
        ...albumResponse,
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
