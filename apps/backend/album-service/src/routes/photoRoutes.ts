import express from 'express';
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
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Photo routes
router.post('/', authenticateToken, createPhoto);
router.get('/album/:albumId', authenticateToken, getPhotosByAlbum);
router.get('/:id', authenticateToken, getPhotoById);
router.get('/by-file/:fileId', getPhotoByFileId); // Public route for file service
router.put('/:id', authenticateToken, updatePhoto);
router.delete('/:id', authenticateToken, deletePhoto);

// AI Analysis routes
router.put('/:id/ai-analysis', authenticateToken, updatePhotoAIAnalysis);
router.get('/album/:albumId/ai-analysis', authenticateToken, getPhotosForAIAnalysis);

// Upload routes
router.post('/upload-url', authenticateToken, getUploadSignedUrlRequest);

export default router;
