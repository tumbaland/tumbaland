import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import { createPlan, deletePlan, getPlans, logPlan, updatePlan } from '../controllers/plan.controller';
import { createPlanSchema, logPlanSchema, updatePlanSchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups and establishes the audit
// context — see authenticateAgent.
router.use(authenticateAgent());

router.get('/', requireScope('relationship:read'), getPlans);
router.post('/', requireScope('relationship:write'), validate(createPlanSchema), createPlan);
router.patch('/:id', requireScope('relationship:write'), validate(updatePlanSchema), updatePlan);
router.delete('/:id', requireScope('relationship:write'), deletePlan);
// "Log it": the plan happened, so it becomes an entry in the journal
router.post('/:id/log', requireScope('relationship:write'), validate(logPlanSchema), logPlan);

export default router;
