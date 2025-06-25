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
router.post('/activities', authenticateToken, createActivity);
router.get('/activities', authenticateToken, getActivities);
router.get('/activities/recent', authenticateToken, getRecentActivities);
router.get('/activities/stats', authenticateToken, getActivityStats);
router.get('/activities/date-range', authenticateToken, getActivitiesByDateRange);
router.get('/activities/types', authenticateToken, getActivityTypes);
router.get('/activities/:id', authenticateToken, getActivityById);
router.put('/activities/:id', authenticateToken, updateActivity);
router.delete('/activities/:id', authenticateToken, deleteActivity);

export default router;
