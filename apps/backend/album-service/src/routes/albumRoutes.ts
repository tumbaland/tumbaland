import express from 'express';
import { authenticateToken } from '@tumbaland/core';
import {
  createAlbum,
  deleteAlbum,
  getAlbumById,
  getAlbums,
  updateAlbum,
  setCoverPhoto,
  removeCoverPhoto
} from '../controllers/albumController';

const router = express.Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

// Album routes
router.post('/', createAlbum);
router.get('/', getAlbums);
router.get('/:id', getAlbumById);
router.put('/:id', updateAlbum);
router.delete('/:id', deleteAlbum);

// Cover photo routes
router.put('/:id/cover', setCoverPhoto);
router.delete('/:id/cover', removeCoverPhoto);

export default router;
