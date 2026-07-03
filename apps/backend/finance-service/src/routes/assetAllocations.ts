import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/core';
import {
  getAssetAllocations,
  createAssetAllocation,
  deleteAssetAllocation,
  updateAssetAllocation
} from '../controllers/assetAllocation.controller';
import { createAssetAllocationSchema, updateAssetAllocationSchema } from '../validation/schemas';

const router = Router();

// Apply authentication middleware (groups are now extracted from JWT)
router.use(authenticateToken);

router.get('/', getAssetAllocations);
router.post('/', validate(createAssetAllocationSchema), createAssetAllocation);
router.delete('/:id', deleteAssetAllocation);
router.put('/:id', validate(updateAssetAllocationSchema), updateAssetAllocation);

export default router;
