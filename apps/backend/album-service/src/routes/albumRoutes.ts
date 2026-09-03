import express from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
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
router.use(authenticateAgent());

// Album routes
router.post('/', requireScope('album:write'), validate(createAlbumSchema), createAlbum);
router.get('/', requireScope('album:read'), getAlbums);
router.get('/:id', requireScope('album:read'), getAlbumById);
router.put('/:id', requireScope('album:write'), validate(updateAlbumSchema), updateAlbum);
router.delete('/:id', requireScope('album:write'), deleteAlbum);

// Cover photo routes
router.put('/:id/cover', requireScope('album:write'), validate(setCoverPhotoSchema), setCoverPhoto);
router.delete('/:id/cover', requireScope('album:write'), removeCoverPhoto);

export default router;
