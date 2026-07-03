import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/core';
import {
  getAssetClasses,
  createAssetClass,
  deleteAssetClass,
  updateAssetClass
} from '../controllers/assetClass.controller';
import { createAssetClassSchema, updateAssetClassSchema } from '../validation/schemas';

const router = Router();

// Apply authentication middleware (groups are now extracted from JWT)
router.use(authenticateToken);

router.get('/', getAssetClasses);
router.post('/', validate(createAssetClassSchema), createAssetClass);
router.delete('/:id', deleteAssetClass);
router.put('/:id', validate(updateAssetClassSchema), updateAssetClass);

export default router;
