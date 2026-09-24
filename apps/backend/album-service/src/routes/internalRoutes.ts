import { Router } from 'express';
import { z } from 'zod';
import { requireInternalServiceToken, validate } from '@tumbaland/backend-core';
import * as ctrl from '../controllers/internalController';

/**
 * Service-to-service surface, for chat-service. No user JWT is involved and no
 * browser ever reaches these routes: the shared internal-token middleware
 * verifies the token itself, constant-time.
 */
const router = Router();

router.use(requireInternalServiceToken);

const createAlbumSchema = z.object({
  name: z.string().trim().min(1, 'name required').max(100),
  userId: z.string().min(1)
});

const chatPhotoSchema = z.object({
  groupId: z.string().min(1),
  albumId: z.string().min(1),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  fileId: z.string().min(1).max(512),
  thumbnailFileId: z.string().max(512).nullish(),
  mimetype: z.string().regex(/^(image|video)\//, 'Only images and videos'),
  size: z.number().int().nonnegative(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  takenAt: z.string().datetime()
});

const moveSchema = z.object({
  groupId: z.string().min(1),
  albumId: z.string().min(1),
  fileIds: z.array(z.string().min(1).max(512)).max(20).optional()
});

const chatCollageSchema = z.object({
  clientId: z.string().min(8).max(100),
  userId: z.string().min(1),
  albumId: z.string().min(1),
  conversationId: z.string().min(1),
  title: z.string().trim().min(1, 'title required').max(100)
});

router.get('/groups/:groupId/albums', ctrl.listGroupAlbums);
router.get('/groups/:groupId/albums/:albumId', ctrl.getGroupAlbum);
router.post('/groups/:groupId/albums', validate(createAlbumSchema), ctrl.createGroupAlbum);
router.post('/groups/:groupId/collages', validate(chatCollageSchema), ctrl.createChatCollage);
router.post('/chat-photos', validate(chatPhotoSchema), ctrl.addChatPhoto);
router.post('/chat-photos/:messageId/move', validate(moveSchema), ctrl.moveChatPhotos);
router.delete('/chat-photos/:messageId', ctrl.removeChatPhotos);

export default router;
