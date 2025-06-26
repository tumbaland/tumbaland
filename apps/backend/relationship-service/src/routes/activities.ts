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
  getActivityTypes
} from '../controllers/activity.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// CRUD routes
router.post('/', authenticateToken, createActivity);
router.get('/', authenticateToken, getActivities);
router.get('/recent', authenticateToken, getRecentActivities);
router.get('/stats', authenticateToken, getActivityStats);
router.get('/date-range', authenticateToken, getActivitiesByDateRange);
router.get('/types', authenticateToken, getActivityTypes);
router.get('/:id', authenticateToken, getActivityById);
router.put('/:id', authenticateToken, updateActivity);
router.delete('/:id', authenticateToken, deleteActivity);

export default router;
