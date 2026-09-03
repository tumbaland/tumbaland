import { Router } from 'express';
import { authenticateAgent, requireScope } from '@tumbaland/backend-core';
import { getDashboard } from '../controllers/dashboard.controller';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateAgent());

// GET /api/dashboard - Get dashboard data
router.get('/', requireScope('finance:read'), getDashboard);

export default router;