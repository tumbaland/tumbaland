import { Router } from 'express';
import {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  getPortfolioSummary,
  getAssetsByDateRange,
  getRecentAssets,
  getTopPerformers,
  updateCurrentPrices
} from '../controllers/asset.controller';

const router = Router();

// CRUD routes
router.post('/', createAsset);
router.get('/', getAssets);
router.get('/recent', getRecentAssets);
router.get('/portfolio-summary', getPortfolioSummary);
router.get('/date-range', getAssetsByDateRange);
router.get('/top-performers', getTopPerformers);
router.put('/update-prices', updateCurrentPrices);
router.get('/:id', getAssetById);
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

export default router;
