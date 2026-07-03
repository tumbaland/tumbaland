import { Router } from 'express';
import { authenticateToken } from '@tumbaland/core';
import {
  createActivityType,
  getActivityTypes,
  getActivityTypeById,
  updateActivityType,
  deleteActivityType,
  reorderActivityTypes
} from '../controllers/activityType.controller';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

// CRUD routes
router.post('/', createActivityType);
router.get('/', getActivityTypes);
router.get('/:id', getActivityTypeById);
router.put('/:id', updateActivityType);
router.delete('/:id', deleteActivityType);

// Special routes
router.post('/reorder', reorderActivityTypes);

export default router;