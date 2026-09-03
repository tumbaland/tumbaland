import express from 'express';
import { authenticateAgent, requireScope } from '@tumbaland/backend-core';
import { getAlbumStatistics } from '../controllers/statisticsController';

const router = express.Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateAgent());

// Statistics routes
router.get('/', requireScope('album:read'), getAlbumStatistics);

export default router;