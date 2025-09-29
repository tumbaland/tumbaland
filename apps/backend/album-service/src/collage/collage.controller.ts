import { Request, Response } from 'express';
import * as collageService from './collage.service';
import { canAccessResource } from '../utils/permissionUtils';
import Album from '../models/Album';
import { getSignedUrl } from '../services/fileService';
import mongoose from 'mongoose';

export const createCollage = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    
    const collage = await collageService.createCollage(req.body, user.id, userGroups);
    res.status(201).json({ collage });
  } catch (error) {
    if ((error as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
};

export const updateCollage = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    
    const collage = await collageService.updateCollage(req.params.id, req.body, user.id, userGroups);
    res.json({ collage });
  } catch (error) {
    if ((error as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
};

export const getCollageById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];

    const collage = await collageService.getCollageById(req.params.id, user.id, userGroups);
    if (!collage) {
      res.status(404).json({ error: 'Collage not found' });
      return;
    }

    // Use aggregation to check album access and fetch photos in one query
    const aggregationPipeline: any[] = [
      { $match: { _id: { $in: collage.albumIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      {
        $lookup: {
          from: 'photos',
          localField: '_id',
          foreignField: 'albumId',
          as: 'photos'
        }
      },
      {
        $project: {
          _id: 1,
          userId: 1,
          groupId: 1,
          isPublic: 1,
          photos: {
            _id: 1,
            filename: 1,
            fileId: 1,
            createdAt: 1,
            title: 1,
            description: 1
          }
        }
      }
    ];

    const albumsWithPhotos = await (Album as any).aggregate(aggregationPipeline);

    // Check access permissions for all albums
    for (const album of albumsWithPhotos) {
      const hasAlbumAccess = canAccessResource(
        user.id,
        album.userId || '',
        album.groupId,
        userGroups,
        false // albums are not public
      );

      if (!hasAlbumAccess) {
        res.status(403).json({ error: 'Access denied to one or more albums' });
        return;
      }
    }

    // Flatten all photos and get signed URLs in parallel
    const allPhotos = albumsWithPhotos.flatMap((album: any) => album.photos);
    const photosWithUrls = await Promise.all(
      allPhotos.map(async (photo: any) => {
        try {
          const signedUrlData = await getSignedUrl(photo.fileId);
          if (!signedUrlData) {
            return photo;
          }
          return {
            ...photo,
            signedUrl: signedUrlData.signedUrl,
            signedUrlExpiresAt: signedUrlData.expiresAt,
            signedUrlExpiresInMinutes: signedUrlData.expiresInMinutes
          };
        } catch (e) {
          return photo;
        }
      })
    );

    res.json({ collage, albumPhotos: photosWithUrls });
  } catch (error) {
    if ((error as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
};

export const getCollageList = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    const albumId = req.query.albumId as string | undefined;
    const groupId = req.query.groupId as string | undefined;
    
    const collages = await collageService.getCollageList(albumId, user.id, userGroups, groupId);
    res.json({ collages });
  } catch (error) {
    if ((error as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
};

export const deleteCollage = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    
    await collageService.deleteCollage(req.params.id, user.id, userGroups);
    res.status(204).send();
  } catch (error) {
    if ((error as Error).message === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Access denied' });
    } else {
      res.status(400).json({ error: (error as Error).message });
    }
  }
};
