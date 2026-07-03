import { Router } from 'express';
import { authenticateToken } from '@tumbaland/core';
import { getDashboard } from '../controllers/dashboard.controller';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

// GET /api/dashboard - Get dashboard data
router.get('/', getDashboard);

export default router;