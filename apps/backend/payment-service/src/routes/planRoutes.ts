import { Router } from 'express';
import { authenticateToken as authenticate, validate } from '@tumbaland/backend-core';
import {
  listPlans,
  listAllPlans,
  createPlan,
  createPlansBulk,
  updatePlan,
  updatePlanLimits,
  updatePlanStripePrices,
  getEntitlementCatalog
} from '../controllers/planController';
import { requireAdmin } from '../middleware/adminMiddleware';
import {
  createPlanSchema,
  createPlansBulkSchema,
  updatePlanSchema,
  updatePlanLimitsSchema,
  updatePlanStripePricesSchema
} from '../validation/schemas';

const router = Router();

router.get('/', authenticate, listPlans);
// Admin surface. `/catalog` and `/all` are what an admin UI loads to render a
// limits editor: the vocabulary, then the current values.
router.get('/catalog', authenticate, requireAdmin, getEntitlementCatalog);
router.get('/all', authenticate, requireAdmin, listAllPlans);
router.post('/', authenticate, requireAdmin, validate(createPlanSchema), createPlan);
router.post('/bulk', authenticate, requireAdmin, validate(createPlansBulkSchema), createPlansBulk);
router.patch('/:code', authenticate, requireAdmin, validate(updatePlanSchema), updatePlan);
router.put('/:code/limits', authenticate, requireAdmin, validate(updatePlanLimitsSchema), updatePlanLimits);
router.patch('/:code/stripe-prices', authenticate, requireAdmin, validate(updatePlanStripePricesSchema), updatePlanStripePrices);

export default router;
