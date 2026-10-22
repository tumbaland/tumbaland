import { z } from 'zod';
import { MESSAGE_EFFECTS } from '../models/Message';

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

/**
 * Documents: PDF, the Office formats, their OpenDocument equivalents, and plain
 * text. No archives or executables. file-service serves anything it does not
 * recognise as a download, never as a page, so these are never rendered in place.
 */
export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/plain',
  'text/csv'
] as const;

/**
 * Voice messages, as browsers record them: WebM (Chrome, Firefox), MP4 (Safari)
 * and Ogg (older Firefox). Recorded in the app, never picked from a file.
 */
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'] as const;

export const ALLOWED_UPLOAD_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_AUDIO_TYPES,
  ...ALLOWED_DOCUMENT_TYPES
];

export const isDocumentType = (mimetype: string): boolean =>
  (ALLOWED_DOCUMENT_TYPES as readonly string[]).includes(mimetype);

export const isAudioType = (mimetype: string): boolean => (ALLOWED_AUDIO_TYPES as readonly string[]).includes(mimetype);

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

/** The app stops a recording at five minutes, a few MB; this leaves room for a high bitrate. */
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
/**
 * What file-service will actually take. The ceiling is Cloudflare, which
 * refuses any request body over 100 MB on this plan, so this sits just under
 * it. It was 200 MB, so a clip between the two got an upload URL and then
 * failed partway through, instead of a message saying why. Going past it needs
 * chunked uploads (see the cloudflared README).
 */
export const MAX_VIDEO_BYTES = 95 * 1024 * 1024;

const attachmentSchema = z.object({
  fileId: z.string().min(1, 'fileId required'),
  posterFileId: z.string().optional(),
  thumbnailFileId: z.string().optional(),
  mimetype: z.enum(ALLOWED_UPLOAD_TYPES as unknown as [string, ...string[]]),
  /** The file's own name, shown on a document. Photos and videos do not need one. */
  name: z.string().max(255).optional(),
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
    effect: z.enum(MESSAGE_EFFECTS).nullish(),
    skipAlbum: z.boolean().optional(),
    /** Photos of this send that stay out of the album, when the rest go in. */
    skipAlbumFileIds: z.array(z.string().max(512)).max(MAX_ATTACHMENTS).optional()
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

/** Which of a message's photos a change is about. Neither means all of them. */
const albumTargets = {
  fileId: z.string().max(512).optional(),
  fileIds: z.array(z.string().max(512)).min(1).max(MAX_ATTACHMENTS).optional()
};

/** One message's photos, or some of them, into an existing album or a new one. */
export const albumPlacementSchema = z.union([
  z.object({ albumId: z.string().min(1).max(64), ...albumTargets }),
  z.object({ newAlbumName: z.string().trim().min(1, 'Name the album').max(100), ...albumTargets })
]);

/** A theme, a background photo (or null to remove it), or both. */
export const appearanceSchema = z
  .object({
    theme: z.string().min(1).max(32).optional(),
    backgroundFileId: z.string().min(1).max(512).nullable().optional()
  })
  .refine((value) => value.theme !== undefined || value.backgroundFileId !== undefined, {
    message: 'Nothing to change'
  });

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

/**
 * Which browser tab is in a call. Made up by the client per page load; it only
 * has to tell one person's devices apart, never to authenticate anything.
 */
const deviceIdSchema = z.string().min(8).max(64);

export const callDeviceSchema = z.object({ deviceId: deviceIdSchema });

/**
 * One WebRTC signal. The SDP ceiling is generous for an audio-only offer
 * (a few kilobytes) and still stops the relay being used to shovel data.
 */
export const callSignalSchema = z.object({
  deviceId: deviceIdSchema,
  data: z
    .object({
      description: z.object({ type: z.enum(['offer', 'answer']), sdp: z.string().max(30_000) }).optional(),
      candidate: z
        .object({
          candidate: z.string().max(1_000),
          sdpMid: z.string().max(64).nullable().optional(),
          sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
          usernameFragment: z.string().max(256).nullable().optional()
        })
        .nullable()
        .optional()
    })
    .refine((data) => data.description !== undefined || data.candidate !== undefined, {
      message: 'A signal needs a description or a candidate'
    })
});

/** "Make a collage together": the card's idempotency key, as for a send, and a title. */
export const startCollageSchema = z.object({
  clientId: z.string().min(8, 'clientId required').max(100),
  title: z.string().trim().min(1, 'Name the collage').max(100)
});

/** album-service, when someone opens a collage made from a chat. */
export const collageActivitySchema = z.object({
  conversationId: z.string().min(1).max(64),
  collageId: z.string().min(1).max(64),
  title: z.string().max(200),
  userId: z.string().min(1).max(64),
  name: z.string().max(200),
  presentUserIds: z.array(z.string().max(64)).max(50)
});

export const planReminderSchema = z.object({
  planId: z.string().min(1).max(64),
  groupId: z.string().min(1).max(64).optional(),
  userId: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timeZone: z.string().min(1).max(64),
  place: z.string().max(200).optional(),
  remindAt: z.string().min(1).max(40)
});

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

/**
 * Sharing where one is, live. Both optional: it runs until stopped (four hours
 * at most), and a destination is a point marked on the map, or none. `null`
 * takes the destination away; leaving it out keeps the one set before.
 */
export const liveStartSchema = z.object({
  minutes: z.number().int().min(5).max(240).optional(),
  destination: z.object({ lat: latitude, lng: longitude, label: z.string().trim().max(200).optional() }).nullish(),
  /** A pin: one place that stays put, rather than a position that moves. */
  fixed: z.boolean().optional(),
  /** What the pin is: a saved place's name, or the address it is at. */
  pinLabel: z.string().trim().max(200).nullish()
});

/** Searching for a place by name, near a point when one is given. */
export const placeSearchSchema = z.object({
  q: z.string().trim().min(2).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional()
});

export const placeReverseSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180)
});

/** A place kept for picking again: "Home". */
export const savedPlaceSchema = z.object({
  name: z.string().trim().min(1, 'Name the place').max(60),
  lat: latitude,
  lng: longitude,
  address: z.string().trim().max(200).optional()
});

/** One position from the phone, as the browser's geolocation gives it. */
export const livePositionSchema = z.object({
  lat: latitude,
  lng: longitude,
  accuracy: z.number().min(0).max(100_000).nullish(),
  heading: z.number().min(0).max(360).nullish(),
  speed: z.number().min(0).max(1000).nullish()
});

/** "Tell me when they are close": where the waiter is, and how close counts. */
export const liveWatchSchema = z.object({
  lat: latitude,
  lng: longitude,
  radiusM: z.number().int().min(100).max(20_000)
});
