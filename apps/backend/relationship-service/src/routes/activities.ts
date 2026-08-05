import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  deleteActivity,
  getRecentActivities,
  getRecentActivitiesSummary,
  getActivityTypes,
  getActivityDescriptions
} from '../controllers/activity.controller';
import { createActivitySchema, updateActivitySchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

// CRUD routes
router.post('/', validate(createActivitySchema), createActivity);
router.get('/', getActivities);
router.get('/recent', getRecentActivities);
router.get('/recent-summary', getRecentActivitiesSummary);
router.get('/types', getActivityTypes);
router.get('/descriptions', getActivityDescriptions);
router.get('/:id', getActivityById);
router.put('/:id', validate(updateActivitySchema), updateActivity);
router.delete('/:id', deleteActivity);

export default router;
