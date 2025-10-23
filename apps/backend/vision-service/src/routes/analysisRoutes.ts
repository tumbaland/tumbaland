import express from 'express';
import {
  uploadAnalysis,
  getAllAnalyses,
  getAnalysisById,
  getAnalysisByDataset,
  deleteAnalysis
} from '../controllers/analysisController';

const router = express.Router();

// POST /analysis/upload - Upload analysis JSON
router.post('/upload', uploadAnalysis);

// GET /analysis - Get all analyses with optional filtering
router.get('/', getAllAnalyses);

// GET /analysis/dataset/:name - Get analyses by dataset name
router.get('/dataset/:name', getAnalysisByDataset);

// GET /analysis/:id - Get analysis by ID
router.get('/:id', getAnalysisById);

// DELETE /analysis/:id - Delete analysis
router.delete('/:id', deleteAnalysis);

export default router;
