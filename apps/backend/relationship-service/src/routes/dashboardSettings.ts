import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import { getDashboardSettings, saveDashboardSettings } from '../controllers/dashboardSettings.controller';
import { saveDashboardSettingsSchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
// Authentication also populates req.userGroups and establishes the audit
// context — see authenticateAgent.
router.use(authenticateAgent());

router.get('/', requireScope('relationship:read'), getDashboardSettings);
router.put('/', requireScope('relationship:write'), validate(saveDashboardSettingsSchema), saveDashboardSettings);

export default router;
