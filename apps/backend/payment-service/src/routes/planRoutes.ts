import { Router } from 'express';
import { listPlans, createPlan, createPlansBulk, updatePlanStripePrices } from '../controllers/planController';
import { authenticate } from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/adminMiddleware';

const router = Router();

router.get('/', authenticate, listPlans);
router.post('/', authenticate, requireAdmin, createPlan);
router.post('/bulk', authenticate, requireAdmin, createPlansBulk);
router.patch('/:code/stripe-prices', authenticate, requireAdmin, updatePlanStripePrices);

export default router;
