import { Router } from 'express';
import { authenticateToken } from '@tumbaland/core';
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

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

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
