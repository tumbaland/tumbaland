import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import { getDashboardSettings, saveDashboardSettings } from '../controllers/dashboardSettings.controller';
import { saveDashboardSettingsSchema } from '../validation/schemas';

const router = Router();

// Authentication also populates req.userGroups from the JWT.
router.use(authenticateToken);

router.get('/', getDashboardSettings);
router.put('/', validate(saveDashboardSettingsSchema), saveDashboardSettings);

export default router;
