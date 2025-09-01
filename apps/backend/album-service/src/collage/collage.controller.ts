import { Request, Response } from 'express';
import * as collageService from './collage.service';
import { canAccessResource } from '../utils/permissionUtils';

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

import Photo from '../models/Photo';
import Album from '../models/Album';
import { getFileUrl } from '../services/fileService';

export const getCollageById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const userGroups = (req as any).userGroups || [];
    
    const collage = await collageService.getCollageById(req.params.id, user.id, userGroups);
    if (!collage) {
      res.status(404).json({ error: 'Collage not found' });
      return;
    }

    // Verify user has access to the album before fetching photos
    const album = await Album.findById(collage.albumId);
    if (!album) {
      res.status(404).json({ error: 'Album not found' });
      return;
    }

    const hasAlbumAccess = canAccessResource(
      user.id,
      album.userId || '',
      album.groupId,
      userGroups,
      false // albums are not public
    );

    if (!hasAlbumAccess) {
      res.status(403).json({ error: 'Access denied to album' });
      return;
    }

    // Fetch all photos for the album
    const photos = await Photo.find({ albumId: collage.albumId }).sort({ createdAt: -1 });
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        try {
          const signedUrl = await getFileUrl(photo.fileId);
          return { ...photo.toObject(), signedUrl };
        } catch (e) {
          return photo.toObject();
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
