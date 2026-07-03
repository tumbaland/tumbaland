import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/core';
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
router.use(authenticateToken);

// CRUD routes
router.post('/', validate(createActivityTypeSchema), createActivityType);
router.get('/', getActivityTypes);
router.get('/:id', getActivityTypeById);
router.put('/:id', validate(updateActivityTypeSchema), updateActivityType);
router.delete('/:id', deleteActivityType);

// Special routes
router.post('/reorder', validate(reorderActivityTypesSchema), reorderActivityTypes);

export default router;
