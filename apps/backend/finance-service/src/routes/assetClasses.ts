import { Router } from 'express';
import { authenticateToken } from '@tumbaland/core';
import {
  getAssetClasses,
  createAssetClass,
  deleteAssetClass,
  updateAssetClass
} from '../controllers/assetClass.controller';

const router = Router();

// Apply authentication middleware (groups are now extracted from JWT)
router.use(authenticateToken);

router.get('/', getAssetClasses);
router.post('/', createAssetClass);
router.delete('/:id', deleteAssetClass);
router.put('/:id', updateAssetClass);

export default router;