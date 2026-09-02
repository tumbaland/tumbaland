import express from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  createPhoto,
  getPhotosByAlbum,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  getAlbumTags,
  bulkUpdateTags,
  getUploadSignedUrlRequest,
  updatePhotoAIAnalysis,
  getPhotosForAIAnalysis,
  getPhotoByFileId,
  getMemories
} from '../controllers/photoController';
import {
  createPhotoSchema,
  updatePhotoSchema,
  uploadSignedUrlSchema,
  updatePhotoAIAnalysisSchema,
  bulkUpdateTagsSchema
} from '../validation/schemas';

const router = express.Router();

// Photo routes
router.post('/', authenticateToken, validate(createPhotoSchema), createPhoto);
router.get('/album/:albumId', authenticateToken, getPhotosByAlbum);
router.get('/album/:albumId/tags', authenticateToken, getAlbumTags);
// Must precede PUT /:id — otherwise '/tags' is swallowed as an :id.
router.put('/tags', authenticateToken, validate(bulkUpdateTagsSchema), bulkUpdateTags);
// Must precede GET /:id, for the same reason PUT /tags does — a literal path
// segment registered after a param route is never reached.
router.get('/memories', authenticateToken, getMemories);
router.get('/:id', authenticateToken, getPhotoById);
router.get('/by-file/:fileId', getPhotoByFileId); // Public route for file service
router.put('/:id', authenticateToken, validate(updatePhotoSchema), updatePhoto);
router.delete('/:id', authenticateToken, deletePhoto);

// AI Analysis routes
router.put('/:id/ai-analysis', authenticateToken, validate(updatePhotoAIAnalysisSchema), updatePhotoAIAnalysis);
router.get('/album/:albumId/ai-analysis', authenticateToken, getPhotosForAIAnalysis);

// Upload routes
router.post('/upload-url', authenticateToken, validate(uploadSignedUrlSchema), getUploadSignedUrlRequest);

export default router;
