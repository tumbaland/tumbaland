import { z } from 'zod';

/** Matches `Message.body`'s maxlength. Both exist: one rejects, one truncates. */
export const MAX_BODY_LENGTH = 8000;

/** Per message. Ten photos is a generous share; a hundred is a bug or an attack. */
export const MAX_ATTACHMENTS = 10;

/**
 * What file-service is allowed to be handed. Anything not on this list is
 * refused before a signed URL is minted, so an arbitrary file type can never
 * reach storage by way of chat.
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif'
] as const;

export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const ALLOWED_UPLOAD_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const attachmentSchema = z.object({
  fileId: z.string().min(1, 'fileId required'),
  posterFileId: z.string().optional(),
  thumbnailFileId: z.string().optional(),
  mimetype: z.enum(ALLOWED_UPLOAD_TYPES as unknown as [string, ...string[]]),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional()
});

/**
 * No member list: membership is the group's, and the roster on the
 * conversation records who has actually visited. A client-supplied list would
 * be either redundant or a way to claim someone is in a conversation.
 */
export const createConversationSchema = z.object({
  groupId: z.string().min(1, 'groupId required'),
  title: z.string().max(120).optional()
});

export const sendMessageSchema = z
  .object({
    /**
     * The client's idempotency key. Required rather than optional: making it
     * optional means the one client that forgets it is the one that
     * double-posts, and the failure only shows up on a bad connection.
     */
    clientId: z.string().min(8, 'clientId required').max(100),
    body: z.string().max(MAX_BODY_LENGTH).optional(),
    attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
    replyTo: z.string().nullish(),
    skipAlbum: z.boolean().optional()
  })
  .refine((value) => Boolean(value.body?.trim()) || (value.attachments?.length ?? 0) > 0, {
    message: 'A message needs text or an attachment'
  });

export const editMessageSchema = z.object({
  body: z.string().max(MAX_BODY_LENGTH)
});

/**
 * One to eight code points. Enough for a flag or a skin-toned thumbs-up
 * (base + modifier + ZWJ sequences), short enough that the field cannot be
 * used to smuggle a message body past the reaction route.
 */
export const reactionSchema = z.object({
  emoji: z
    .string()
    .min(1, 'emoji required')
    .refine((value) => [...value].length <= 8, { message: 'Not an emoji' })
});

export const markReadSchema = z.object({
  lastReadMessageId: z.string().optional()
});

export const uploadUrlSchema = z.object({
  filename: z.string().min(1, 'filename required').max(255),
  mimetype: z.enum(ALLOWED_UPLOAD_TYPES as unknown as [string, ...string[]]),
  sizeBytes: z.number().int().positive()
});

export const thumbnailSchema = z.object({
  fileId: z.string().min(1, 'fileId required').max(512),
  mimetype: z.enum(ALLOWED_UPLOAD_TYPES as unknown as [string, ...string[]])
});

/** Where the conversation's photos go: an existing group album, a new one, or nowhere. */
export const photoAlbumSchema = z.union([
  z.object({ mode: z.literal('off') }),
  z.object({ mode: z.literal('album'), albumId: z.string().min(1).max(64) }),
  z.object({ mode: z.literal('album'), newAlbumName: z.string().trim().min(1, 'Name the album').max(100) })
]);

/** One message's photos, or one of them, into an existing album or a new one. */
export const albumPlacementSchema = z.union([
  z.object({ albumId: z.string().min(1).max(64), fileId: z.string().max(512).optional() }),
  z.object({ newAlbumName: z.string().trim().min(1, 'Name the album').max(100), fileId: z.string().max(512).optional() })
]);

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('endpoint must be a URL'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1)
  }),
  platform: z.string().max(40).optional()
});

export const unsubscribeSchema = z.object({
  endpoint: z.string().url('endpoint must be a URL')
});
