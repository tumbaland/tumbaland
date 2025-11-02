import express from 'express';
import {
  createDatasetImage,
  getImagesByDataset,
  getImageById,
  updateImage,
  deleteImage,
  getUploadSignedUrlRequest
} from '../controllers/datasetImageController';

const router = express.Router();

// Dataset image routes
router.get('/dataset/:datasetId', getImagesByDataset);
router.get('/:id', getImageById);
router.post('/', createDatasetImage);
router.put('/:id', updateImage);
router.delete('/:id', deleteImage);

// Upload signed URL
router.post('/upload-url', getUploadSignedUrlRequest);

export default router;