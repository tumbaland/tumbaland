import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import { getHoldings, getClosed, addHolding, editHolding, removeHolding } from '../controllers/holding.controller';
import { createHoldingSchema, updateHoldingSchema } from '../validation/schemas';

const router = Router();

// Apply authentication middleware (groups are extracted from JWT)
router.use(authenticateAgent());

router.get('/', requireScope('finance:read'), getHoldings);
router.get('/closed', requireScope('finance:read'), getClosed);
router.post('/', requireScope('finance:write'), validate(createHoldingSchema), addHolding);
router.put('/:id', requireScope('finance:write'), validate(updateHoldingSchema), editHolding);
router.delete('/:id', requireScope('finance:write'), removeHolding);

export default router;
