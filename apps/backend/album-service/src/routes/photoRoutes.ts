import express from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  createPhoto,
  getPhotosByAlbum,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  getUploadSignedUrlRequest,
  updatePhotoAIAnalysis,
  getPhotosForAIAnalysis,
  getPhotoByFileId
} from '../controllers/photoController';
import { createPhotoSchema, updatePhotoSchema, uploadSignedUrlSchema, updatePhotoAIAnalysisSchema } from '../validation/schemas';

const router = express.Router();

// Photo routes
router.post('/', authenticateToken, validate(createPhotoSchema), createPhoto);
router.get('/album/:albumId', authenticateToken, getPhotosByAlbum);
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
