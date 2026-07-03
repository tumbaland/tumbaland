import { Router } from 'express';
import { authenticateToken as authenticate, validate } from '@tumbaland/core';
import { listPlans, createPlan, createPlansBulk, updatePlanStripePrices } from '../controllers/planController';
import { requireAdmin } from '../middleware/adminMiddleware';
import { createPlanSchema, createPlansBulkSchema, updatePlanStripePricesSchema } from '../validation/schemas';

const router = Router();

router.get('/', authenticate, listPlans);
router.post('/', authenticate, requireAdmin, validate(createPlanSchema), createPlan);
router.post('/bulk', authenticate, requireAdmin, validate(createPlansBulkSchema), createPlansBulk);
router.patch('/:code/stripe-prices', authenticate, requireAdmin, validate(updatePlanStripePricesSchema), updatePlanStripePrices);

export default router;
