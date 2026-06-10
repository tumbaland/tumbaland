import { Router } from 'express';
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getActivityStats,
  getActivitiesByDateRange,
  getRecentActivities,
  getRecentActivitiesSummary,
  getActivityTypes,
  getActivityDescriptions
} from '../controllers/activity.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { attachUserGroups } from '../middleware/userGroupsMiddleware';

const router = Router();

// Apply authentication and group middleware to all routes
router.use(authenticateToken);
router.use(attachUserGroups);

// CRUD routes
router.post('/', createActivity);
router.get('/', getActivities);
router.get('/recent', getRecentActivities);
router.get('/recent-summary', getRecentActivitiesSummary);
router.get('/stats', getActivityStats);
router.get('/date-range', getActivitiesByDateRange);
router.get('/types', getActivityTypes);
router.get('/descriptions', getActivityDescriptions);
router.get('/:id', getActivityById);
router.put('/:id', updateActivity);
router.delete('/:id', deleteActivity);

export default router;
