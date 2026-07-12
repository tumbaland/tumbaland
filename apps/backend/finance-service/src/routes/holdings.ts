import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import { getHoldings, addHolding, editHolding, removeHolding } from '../controllers/holding.controller';
import { createHoldingSchema, updateHoldingSchema } from '../validation/schemas';

const router = Router();

// Apply authentication middleware (groups are extracted from JWT)
router.use(authenticateToken);

router.get('/', getHoldings);
router.post('/', validate(createHoldingSchema), addHolding);
router.put('/:id', validate(updateHoldingSchema), editHolding);
router.delete('/:id', removeHolding);

export default router;
