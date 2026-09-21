/** The wire shapes chat-service returns. Mirrors its `docs/openapi.yml`. */

export interface Attachment {
  fileId: string;
  /** Signed, short-lived, minted per response. Null when file-service was unreachable. */
  url?: string | null;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  posterFileId?: string | null;
  thumbnailFileId?: string | null;
  mimetype: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

export interface Reaction {
  userId: string;
  name: string;
  emoji: string;
  at: string;
}

export interface ConversationMember {
  userId: string;
  email: string;
  name: string;
  joinedAt: string;
}

export interface Conversation {
  id: string;
  groupId: string;
  title: string;
  members: ConversationMember[];
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastMessageSender: string;
  unreadCount: number;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  kind: 'text' | 'media' | 'system';
  body: string;
  attachments: Attachment[];
  replyTo: string | null;
  reactions: Reaction[];
  clientId: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

/**
 * A message the client has composed but not yet had confirmed.
 *
 * Kept as the same shape as a stored message with an extra status, so the
 * thread renders one list rather than two and a message does not jump when it
 * is acknowledged.
 */
export type DeliveryState = 'pending' | 'sent' | 'failed';

export interface ThreadMessage extends Message {
  /** Absent on anything that came from the server. */
  delivery?: DeliveryState;
}

export interface MessagePage {
  messages: Message[];
  nextCursor: string | null;
}

/** Events the SSE stream delivers. */
export type ChatEventType =
  | 'message.created'
  | 'message.updated'
  | 'message.deleted'
  | 'reaction.updated'
  | 'conversation.updated'
  | 'typing'
  | 'read';

export interface ChatEvent {
  type: ChatEventType;
  conversationId: string;
  at: number;
  payload: unknown;
}

export interface TypingPayload {
  userId: string;
  name: string;
}

export interface ReadPayload {
  userId: string;
  name: string;
  lastReadMessageId: string | null;
}

/** What the server returns when asked where to put an upload. */
export interface UploadTicket {
  uploadUrl: string;
  fileId: string;
  /** Where a video's poster frame should go, or null for an image. */
  posterUploadFileId: string | null;
  expiresInMinutes: number;
}

/** A file being prepared or uploaded, before it becomes an attachment. */
export interface PendingUpload {
  id: string;
  name: string;
  mimetype: string;
  /** Object URL for the local preview, revoked when the upload is cleared. */
  previewUrl: string;
  progress: number;
  status: 'preparing' | 'uploading' | 'done' | 'failed';
  error?: string;
  attachment?: Attachment;
}
