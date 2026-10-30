import { Router } from 'express';
import { requireAdmin, validate } from '@tumbaland/backend-core';
import * as admin from '../controllers/assistantAdminController';
import { assistantKeySchema } from '../validation/schemas';

/**
 * The Claude page in admin-front: the API key, the models on offer, and who is
 * using what. Administrators only, and never through an API key: the key is
 * what pays for everyone's assistants.
 */
const router = Router();

router.use(requireAdmin);
router.get('/assistant-key', admin.getKey);
router.put('/assistant-key', validate(assistantKeySchema), admin.putKey);
router.post('/assistant-key/check', admin.checkKey);
router.delete('/assistant-key', admin.deleteKey);
router.get('/assistant-usage', admin.usage);

export default router;
