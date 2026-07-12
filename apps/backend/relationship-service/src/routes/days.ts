import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import { getDays, saveDay } from '../controllers/day.controller';
import { saveDaySchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

router.get('/', getDays);
// The day editor's save: create/replace all entries for one date in one call
router.put('/:date', validate(saveDaySchema), saveDay);

export default router;
