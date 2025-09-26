import { Router } from 'express';
import {
  createActivityType,
  getActivityTypes,
  getActivityTypeById,
  updateActivityType,
  deleteActivityType,
  reorderActivityTypes
} from '../controllers/activityType.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { attachUserGroups } from '../middleware/userGroupsMiddleware';

const router = Router();

// Apply authentication and group middleware to all routes
router.use(authenticateToken);
router.use(attachUserGroups);

// CRUD routes
router.post('/', createActivityType);
router.get('/', getActivityTypes);
router.get('/:id', getActivityTypeById);
router.put('/:id', updateActivityType);
router.delete('/:id', deleteActivityType);

// Special routes
router.post('/reorder', reorderActivityTypes);

export default router;