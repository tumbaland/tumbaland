import { Router } from 'express';
import { authenticateAgent, authenticateToken, requireScope, validate } from '@tumbaland/backend-core';
import * as collageController from './collage.controller';
import { getCollagePreview } from './preview/preview.controller';
import { collageAlbumsSchema, createCollageSchema, updateCollageSchema } from '../validation/schemas';

const router = Router();

// A connected assistant can list, read, look at and make collages, and add
// albums to one it made. Changing one goes through the changes route
// (collageLiveRoutes), where it is held to the collages it made.
router.post('/', authenticateAgent(), requireScope('album:write'), validate(createCollageSchema), collageController.createCollage);
// Held to the collages an assistant made, like the changes route.
router.post(
  '/:id/albums',
  authenticateAgent(),
  requireScope('album:write'),
  validate(collageAlbumsSchema),
  collageController.addCollageAlbums
);
router.get('/:id/preview', authenticateAgent(), requireScope('album:read'), getCollagePreview);
router.get('/:id', authenticateAgent(), requireScope('album:read'), collageController.getCollageById);
// GET /collages?albumId=... to filter by album
router.get('/', authenticateAgent(), requireScope('album:read'), collageController.getCollageList);

// A person's to do: replacing a whole collage at once, and deleting one.
// authenticateToken refuses every API key and assistant token.
router.put('/:id', authenticateToken, validate(updateCollageSchema), collageController.updateCollage);
router.delete('/:id', authenticateToken, collageController.deleteCollage);

export default router;
