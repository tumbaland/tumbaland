import express from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import {
  createPhoto,
  getPhotosByAlbum,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  getAlbumTags,
  bulkUpdateTags,
  getUploadSignedUrlRequest,
  getPhotoByFileId,
  getMemories,
  getRecentPhotos,
  getRandomPhotos
} from '../controllers/photoController';
import { getAlbumContactSheet } from '../collage/preview/preview.controller';
import {
  createPhotoSchema,
  updatePhotoSchema,
  uploadSignedUrlSchema,
  bulkUpdateTagsSchema
} from '../validation/schemas';

const router = express.Router();

// Photo routes
router.post('/', authenticateAgent(), requireScope('album:write'), validate(createPhotoSchema), createPhoto);
router.get('/album/:albumId', authenticateAgent(), requireScope('album:read'), getPhotosByAlbum);
router.get('/album/:albumId/tags', authenticateAgent(), requireScope('album:read'), getAlbumTags);
// The album as a numbered grid of pictures, for an assistant choosing photos for a collage.
router.get('/album/:albumId/sheet', authenticateAgent(), requireScope('album:read'), getAlbumContactSheet);
// Must precede PUT /:id — otherwise '/tags' is swallowed as an :id.
router.put('/tags', authenticateAgent(), requireScope('album:write'), validate(bulkUpdateTagsSchema), bulkUpdateTags);
// Must precede GET /:id, for the same reason PUT /tags does — a literal path
// segment registered after a param route is never reached.
router.get('/memories', authenticateAgent(), requireScope('album:read'), getMemories);
// Above '/:id', or Express reads 'recent' and 'random' as photo ids.
router.get('/recent', authenticateAgent(), requireScope('album:read'), getRecentPhotos);
router.get('/random', authenticateAgent(), requireScope('album:read'), getRandomPhotos);
router.get('/:id', authenticateAgent(), requireScope('album:read'), getPhotoById);
router.get('/by-file/:fileId', getPhotoByFileId); // Public route for file service
router.put('/:id', authenticateAgent(), requireScope('album:write'), validate(updatePhotoSchema), updatePhoto);
router.delete('/:id', authenticateAgent(), requireScope('album:write'), deletePhoto);

// Upload routes
router.post(
  '/upload-url',
  authenticateAgent(),
  requireScope('album:write'),
  validate(uploadSignedUrlSchema),
  getUploadSignedUrlRequest
);

export default router;
