import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import { getSnapshots, upsertSnapshot, deleteSnapshot } from '../controllers/snapshot.controller';
import { upsertSnapshotSchema } from '../validation/schemas';

const router = Router();

// Apply authentication middleware (groups are extracted from JWT)
router.use(authenticateAgent());

router.get('/', requireScope('finance:read'), getSnapshots);
// The monthly check-in: create or replace a whole month in one call
router.put('/:month', requireScope('finance:write'), validate(upsertSnapshotSchema), upsertSnapshot);
router.delete('/:id', requireScope('finance:write'), deleteSnapshot);

export default router;
