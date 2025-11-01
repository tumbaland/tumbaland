import { Router } from 'express';
import { getDashboard } from '../controllers/dashboard.controller';
import { authenticateToken } from '../middleware/authMiddleware';
import { userGroupsMiddleware } from '../middleware/userGroupsMiddleware';

const router = Router();

// Apply authentication middleware
router.use(authenticateToken);

// GET /api/dashboard - Get dashboard data
router.get('/', userGroupsMiddleware, getDashboard);

export default router;