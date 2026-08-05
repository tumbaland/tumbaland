import { Router } from 'express';
import { authenticateToken } from '@tumbaland/backend-core';
import { getPlaces, getPlaceVisits } from '../controllers/place.controller';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

/**
 * @route GET /api/places
 * @desc Distinct places in scope with visit counts and per-type breakdown
 * @query groupId, typeId, startDate, endDate - all optional filters
 */
router.get('/', getPlaces);

/**
 * @route GET /api/places/visits
 * @desc Individual visits behind one pin, newest first
 * @query lat, lng - required; groupId, limit - optional
 */
router.get('/visits', getPlaceVisits);

export default router;
