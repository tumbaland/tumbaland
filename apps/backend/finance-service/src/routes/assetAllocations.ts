import { Router } from 'express';
import { authenticateToken } from '@tumbaland/core';
import {
  getAssetAllocations,
  createAssetAllocation,
  deleteAssetAllocation,
  updateAssetAllocation
} from '../controllers/assetAllocation.controller';

const router = Router();

// Apply authentication middleware (groups are now extracted from JWT)
router.use(authenticateToken);

router.get('/', getAssetAllocations);
router.post('/', createAssetAllocation);
router.delete('/:id', deleteAssetAllocation);
router.put('/:id', updateAssetAllocation);

export default router;