import { Router } from 'express';
import { authenticateAgent, authenticateToken, requireScope, validate } from '@tumbaland/backend-core';
import * as collageController from './collage.controller';
import { getCollagePreview } from './preview/preview.controller';
import { createCollageSchema, updateCollageSchema } from '../validation/schemas';

const router = Router();

// A connected assistant can list, read, look at and make collages. Changing
// one goes through the changes route (collageLiveRoutes), where it is held to
// the collages it made.
router.post('/', authenticateAgent(), requireScope('album:write'), validate(createCollageSchema), collageController.createCollage);
router.get('/:id/preview', authenticateAgent(), requireScope('album:read'), getCollagePreview);
router.get('/:id', authenticateAgent(), requireScope('album:read'), collageController.getCollageById);
// GET /collages?albumId=... to filter by album
router.get('/', authenticateAgent(), requireScope('album:read'), collageController.getCollageList);

// A person's to do: replacing a whole collage at once, and deleting one.
// authenticateToken refuses every API key and assistant token.
router.put('/:id', authenticateToken, validate(updateCollageSchema), collageController.updateCollage);
router.delete('/:id', authenticateToken, collageController.deleteCollage);

export default router;
