import express from 'express';
import { authenticateToken } from '@tumbaland/core';
import { getAlbumStatistics } from '../controllers/statisticsController';

const router = express.Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

// Statistics routes
router.get('/', getAlbumStatistics);

export default router;