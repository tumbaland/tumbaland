import express from 'express';
import {
  createDatasetImage,
  getAllImages,
  getImagesByDataset,
  getImagesByCategory,
  getImageLabelsStats,
  exportImagesByLabels,
  getImageById,
  updateImage,
  deleteImage,
  getUploadSignedUrlRequest,
  exportImageNames
} from '../controllers/datasetImageController';

const router = express.Router();

// Dataset image routes
router.get('/', getAllImages);
router.get('/dataset/:datasetId', getImagesByDataset);
router.get('/dataset/:datasetId/category/:categoryId', getImagesByCategory);
router.get('/dataset/:datasetId/labels/stats', getImageLabelsStats);
router.get('/dataset/:datasetId/export/csv', exportImagesByLabels);
router.get('/export-names/:datasetId', exportImageNames);
router.get('/:id', getImageById);
router.post('/', createDatasetImage);
router.put('/:id', updateImage);
router.delete('/:id', deleteImage);

// Upload signed URL
router.post('/upload-url', getUploadSignedUrlRequest);

export default router;