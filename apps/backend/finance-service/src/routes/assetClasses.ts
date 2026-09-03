import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import {
  getAssetClasses,
  createAssetClass,
  deleteAssetClass,
  updateAssetClass
} from '../controllers/assetClass.controller';
import { createAssetClassSchema, updateAssetClassSchema } from '../validation/schemas';

const router = Router();

// Apply authentication middleware (groups are now extracted from JWT)
router.use(authenticateAgent());

router.get('/', requireScope('finance:read'), getAssetClasses);
router.post('/', requireScope('finance:write'), validate(createAssetClassSchema), createAssetClass);
router.delete('/:id', requireScope('finance:write'), deleteAssetClass);
router.put('/:id', requireScope('finance:write'), validate(updateAssetClassSchema), updateAssetClass);

export default router;
