import { Router } from 'express';
import { authenticateToken as authenticate } from '@tumbaland/core';
import { listPlans, createPlan, createPlansBulk, updatePlanStripePrices } from '../controllers/planController';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

router.get('/', authenticate, listPlans);
router.post('/', authenticate, requireAdmin, createPlan);
router.post('/bulk', authenticate, requireAdmin, createPlansBulk);
router.patch('/:code/stripe-prices', authenticate, requireAdmin, updatePlanStripePrices);

export default router;
