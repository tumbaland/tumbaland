import express from 'express';
import { getAlbumStatistics } from '../controllers/statisticsController';
import { authenticateToken } from '../middleware/authMiddleware';
import { userGroupsMiddleware } from '../middleware/userGroupsMiddleware';

const router = express.Router();

// Apply authentication and group middleware to all routes
router.use(authenticateToken);
router.use(userGroupsMiddleware);

// Statistics routes
router.get('/', getAlbumStatistics);

export default router;