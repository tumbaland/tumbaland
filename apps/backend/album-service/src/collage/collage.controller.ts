import { Request, Response } from 'express';
import * as collageService from './collage.service';

export const createCollage = async (req: Request, res: Response) => {
  try {
    const collage = await collageService.createCollage(req.body);
    res.status(201).json({ collage });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const updateCollage = async (req: Request, res: Response) => {
  try {
    const collage = await collageService.updateCollage(req.params.id, req.body);
    res.json({ collage });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

import Photo from '../models/Photo';
import { getFileUrl } from '../services/fileService';

export const getCollageById = async (req: Request, res: Response): Promise<void> => {
  try {
    const collage = await collageService.getCollageById(req.params.id);
    if (!collage) {
      res.status(404).json({ error: 'Collage not found' });
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
    res.status(400).json({ error: (error as Error).message });
  }
};

export const getCollageList = async (req: Request, res: Response) => {
  try {
    const albumId = req.query.albumId as string | undefined;
    const collages = await collageService.getCollageList(albumId);
    res.json({ collages });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const deleteCollage = async (req: Request, res: Response) => {
  try {
    await collageService.deleteCollage(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
