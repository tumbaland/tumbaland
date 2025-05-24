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

const router = Router();

// CRUD routes
router.post('/activities', createActivity);
router.get('/activities', getActivities);
router.get('/activities/recent', getRecentActivities);
router.get('/activities/stats', getActivityStats);
router.get('/activities/date-range', getActivitiesByDateRange);
router.get('/activities/types', getActivityTypes);
router.get('/activities/:id', getActivityById);
router.put('/activities/:id', updateActivity);
router.delete('/activities/:id', deleteActivity);

export default router;
