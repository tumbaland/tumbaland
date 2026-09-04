import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
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
// Authentication also populates req.userGroups and establishes the audit
// context — see authenticateAgent.
router.use(authenticateAgent());

// CRUD routes
router.post('/', requireScope('relationship:write'), validate(createActivitySchema), createActivity);
router.get('/', requireScope('relationship:read'), getActivities);
router.get('/recent', requireScope('relationship:read'), getRecentActivities);
router.get('/recent-summary', requireScope('relationship:read'), getRecentActivitiesSummary);
router.get('/types', requireScope('relationship:read'), getActivityTypes);
router.get('/descriptions', requireScope('relationship:read'), getActivityDescriptions);
router.get('/:id', requireScope('relationship:read'), getActivityById);
router.put('/:id', requireScope('relationship:write'), validate(updateActivitySchema), updateActivity);
router.delete('/:id', requireScope('relationship:write'), deleteActivity);

export default router;
