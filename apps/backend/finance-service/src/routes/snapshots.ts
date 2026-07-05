import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/core';
import { getSnapshots, upsertSnapshot, deleteSnapshot } from '../controllers/snapshot.controller';
import { upsertSnapshotSchema } from '../validation/schemas';

const router = Router();

// Apply authentication middleware (groups are extracted from JWT)
router.use(authenticateToken);

router.get('/', getSnapshots);
// The monthly check-in: create or replace a whole month in one call
router.put('/:month', validate(upsertSnapshotSchema), upsertSnapshot);
router.delete('/:id', deleteSnapshot);

export default router;
