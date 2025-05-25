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
router.post('/assets', createAsset);
router.get('/assets', getAssets);
router.get('/assets/recent', getRecentAssets);
router.get('/assets/portfolio-summary', getPortfolioSummary);
router.get('/assets/date-range', getAssetsByDateRange);
router.get('/assets/top-performers', getTopPerformers);
router.put('/assets/update-prices', updateCurrentPrices);
router.get('/assets/:id', getAssetById);
router.put('/assets/:id', updateAsset);
router.delete('/assets/:id', deleteAsset);

export default router;
