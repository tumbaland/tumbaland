import { Router } from 'express';
import { authenticateToken, validate } from '@tumbaland/backend-core';
import {
  getStatementSettings,
  updateStatementSettings
} from '../controllers/statementSettings.controller';
import { updateStatementSettingsSchema } from '../validation/schemas';

const router = Router();

router.use(authenticateToken);

router.get('/', getStatementSettings);
router.put('/', validate(updateStatementSettingsSchema), updateStatementSettings);

export default router;
