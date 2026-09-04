import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import { getDays, saveDay } from '../controllers/day.controller';
import { saveDaySchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
// Authentication also populates req.userGroups and establishes the audit
// context — see authenticateAgent.
router.use(authenticateAgent());

router.get('/', requireScope('relationship:read'), getDays);
// The day editor's save: create/replace all entries for one date in one call
router.put('/:date', requireScope('relationship:write'), validate(saveDaySchema), saveDay);

export default router;
