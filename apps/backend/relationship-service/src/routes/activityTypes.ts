import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import {
  createActivityType,
  getActivityTypes,
  getActivityTypeById,
  updateActivityType,
  deleteActivityType,
  reorderActivityTypes
} from '../controllers/activityType.controller';
import { createActivityTypeSchema, updateActivityTypeSchema, reorderActivityTypesSchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateAgent());

// CRUD routes
router.post('/', requireScope('relationship:write'), validate(createActivityTypeSchema), createActivityType);
router.get('/', requireScope('relationship:read'), getActivityTypes);
router.get('/:id', requireScope('relationship:read'), getActivityTypeById);
router.put('/:id', requireScope('relationship:write'), validate(updateActivityTypeSchema), updateActivityType);
router.delete('/:id', requireScope('relationship:write'), deleteActivityType);

// Special routes
router.post('/reorder', requireScope('relationship:write'), validate(reorderActivityTypesSchema), reorderActivityTypes);

export default router;
