import express from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  createAlbum,
  deleteAlbum,
  getAlbumById,
  getAlbums,
  updateAlbum,
  setCoverPhoto,
  removeCoverPhoto
} from '../controllers/albumController';
import { createAlbumSchema, updateAlbumSchema, setCoverPhotoSchema } from '../validation/schemas';

const router = express.Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

// Album routes
router.post('/', validate(createAlbumSchema), createAlbum);
router.get('/', getAlbums);
router.get('/:id', getAlbumById);
router.put('/:id', validate(updateAlbumSchema), updateAlbum);
router.delete('/:id', deleteAlbum);

// Cover photo routes
router.put('/:id/cover', validate(setCoverPhotoSchema), setCoverPhoto);
router.delete('/:id/cover', removeCoverPhoto);

export default router;
