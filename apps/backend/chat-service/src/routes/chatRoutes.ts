import { Router } from 'express';
import { createRateLimiter, validate } from '@tumbaland/backend-core';
import * as ctrl from '../controllers/chatController';
import { caller } from '../services/accessService';
import { touch as touchPresence } from '../services/presenceService';
import {
  createConversationSchema,
  editMessageSchema,
  markReadSchema,
  photoAlbumSchema,
  albumPlacementSchema,
  pushSubscriptionSchema,
  reactionSchema,
  sendMessageSchema,
  thumbnailSchema,
  unsubscribeSchema,
  uploadUrlSchema
} from '../validation/schemas';

const router = Router();

// Every chat request is a sign of life, including the shell's minute-by-minute
// unread poll, which is what lets presence mean "using Tumbaland" rather than
// "has the chat open". Not awaited: it never fails a request.
router.use((req, _res, next) => {
  void touchPresence(caller(req));
  next();
});

/**
 * Tighter than `standardRateLimiter` (300 per 15 minutes), because sending is
 * the one route a runaway client can hammer. Two people in a fast conversation
 * are nowhere near 120 messages in five minutes; a retry loop passes it in
 * seconds.
 */
const sendLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: { success: false, message: 'Slow down a moment' }
});

/**
 * Typing fires on a keystroke burst, so it gets its own, much higher, ceiling.
 * It stores nothing, and a dropped typing event costs nothing.
 */
const typingLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120, message: { success: false, message: 'ok' } });

router.get('/conversations', ctrl.listConversations);
router.post('/conversations', validate(createConversationSchema), ctrl.createConversation);
// What the app opens with: ensures a conversation exists in each of the
// caller's groups and returns them. No body, because the groups come from the
// session rather than from the client.
router.post('/conversations/mine', ctrl.ensureMyConversations);
router.get('/unread', ctrl.unreadCount);

// Web Push registration. The subscription belongs to the shell's origin, which
// is where the service worker lives; this service only stores it.
router.post('/push/subscriptions', validate(pushSubscriptionSchema), ctrl.subscribePush);
router.delete('/push/subscriptions', validate(unsubscribeSchema), ctrl.unsubscribePush);
router.get('/search', ctrl.search);

// GET /api/chat/stream is deliberately not here: app.ts registers it ahead of
// the rate limiter.

router.get('/conversations/:id', ctrl.getConversation);
router.get('/conversations/:id/messages', ctrl.listMessages);
router.post('/conversations/:id/messages', sendLimiter, validate(sendMessageSchema), ctrl.sendMessage);
router.patch('/conversations/:id/messages/:messageId', validate(editMessageSchema), ctrl.editMessage);
router.delete('/conversations/:id/messages/:messageId', ctrl.deleteMessage);
router.put('/conversations/:id/messages/:messageId/reactions', validate(reactionSchema), ctrl.toggleReaction);
// Album: where the conversation's photos go, and taking one message back out.
router.get('/conversations/:id/albums', ctrl.listAlbums);
router.put('/conversations/:id/photo-album', validate(photoAlbumSchema), ctrl.setPhotoAlbum);
router.put('/conversations/:id/messages/:messageId/album', validate(albumPlacementSchema), ctrl.placeInAlbum);
router.delete('/conversations/:id/messages/:messageId/album', ctrl.removeFromAlbum);
// Attachments. The bytes go straight from the browser to file-service; only
// the permission check, the quota gate and the thumbnail pass through here.
router.post('/conversations/:id/attachments/upload-url', validate(uploadUrlSchema), ctrl.attachmentUploadUrl);
router.post('/conversations/:id/attachments/thumbnail', validate(thumbnailSchema), ctrl.attachmentThumbnail);

router.post('/conversations/:id/read', validate(markReadSchema), ctrl.markRead);
router.post('/conversations/:id/typing', typingLimiter, ctrl.typing);

export default router;
