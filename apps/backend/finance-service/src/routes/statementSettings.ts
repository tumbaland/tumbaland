import { Router } from 'express';
import { authenticateAgent, requireScope, validate } from '@tumbaland/backend-core';
import {
  getStatementSettings,
  updateStatementSettings
} from '../controllers/statementSettings.controller';
import { updateStatementSettingsSchema } from '../validation/schemas';

const router = Router();

router.use(authenticateAgent());

router.get('/', requireScope('finance:read'), getStatementSettings);
router.put('/', requireScope('finance:write'), validate(updateStatementSettingsSchema), updateStatementSettings);

export default router;
