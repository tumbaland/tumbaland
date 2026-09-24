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
  /** The album this file was saved to, once Album has it. */
  albumId?: string | null;
  albumName?: string | null;
}

/** Where a conversation's photos go in Album. `unset` until someone chooses. */
export interface PhotoAlbum {
  mode: 'unset' | 'album' | 'off';
  albumId: string | null;
  albumName: string | null;
}

/** How the thread looks, for everyone in it. */
export interface Appearance {
  theme: string;
  backgroundFileId: string | null;
  /** Signed and short-lived; null when there is no background or it could not be signed. */
  backgroundUrl: string | null;
}

/** One of the group's albums, as the picker lists them. */
export interface AlbumOption {
  id: string;
  name: string;
  photoCount: number;
}

/** Where one sent message's photos, or one photo, should be. */
export type AlbumPlacement = { albumId: string } | { newAlbumName: string };

export type PhotoAlbumChoice = { mode: 'off' } | { mode: 'album'; albumId: string } | { mode: 'album'; newAlbumName: string };

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
  /** Profile picture URL. Absent until they open chat with one set. */
  picture?: string | null;
  joinedAt: string;
}

/** How far one of the others has read. */
export interface ReadReceipt {
  userId: string;
  lastReadMessageId: string | null;
  lastReadAt: string;
}

/** Whether someone is using Tumbaland, and when they last were. */
export interface Presence {
  userId: string;
  online: boolean;
  /** Null when never seen. */
  lastActiveAt: string | null;
}

/** One conversation as the thread page opens it. */
export interface ConversationDetail {
  id: string;
  groupId: string;
  title: string;
  members: ConversationMember[];
  /** Everyone but the caller. */
  reads: ReadReceipt[];
  /** Everyone but the caller. Absent from a server older than presence. */
  presence?: Presence[];
  /** Absent from a server older than saving to Album. */
  photoAlbum?: PhotoAlbum;
  /** Absent from a server older than themes. */
  appearance?: Appearance;
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
  /** Everyone but the caller. Absent from a server older than presence. */
  presence?: Presence[];
}

/** What a message was sent with: around its bubble, and across the screen when it arrives. */
export type MessageEffect = 'hearts' | 'confetti' | 'kisses';

/** How a message is sent, beyond its text and attachments. */
export interface SendOptions {
  /** "Not this one" on the photo tray: keep this send out of the album. */
  skipAlbum?: boolean;
  effect?: MessageEffect;
}

/** "Make a collage together": the collage a card invites the others to. */
export interface CollageCard {
  id: string;
  title: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  kind: 'text' | 'media' | 'system' | 'collage';
  body: string;
  attachments: Attachment[];
  replyTo: string | null;
  /** Absent from a server older than effects. */
  effect?: MessageEffect | null;
  /** On a `collage` message: the collage in Album that "Join" opens. */
  collage?: CollageCard | null;
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
  | 'read'
  | 'presence'
  | 'call.ringing'
  | 'call.accepted'
  | 'call.ended'
  | 'call.signal';

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
  /** Absent from a server older than read times. */
  lastReadAt?: string;
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

/** One entry of `RTCConfiguration.iceServers`, as chat-service hands it over. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** What a call connects with. `relay: false` means some networks will not connect. */
export interface IceConfig {
  iceServers: IceServer[];
  relay: boolean;
  expiresAt: string | null;
}

export interface CallPerson {
  userId: string;
  name: string;
  picture: string | null;
}

export type CallEndReason = 'hangup' | 'declined' | 'cancelled' | 'missed' | 'dropped';

/** A call as chat-service describes it, and as every `call.*` event but `call.signal` carries it. */
export interface CallView {
  id: string;
  conversationId: string;
  caller: CallPerson;
  callees: CallPerson[];
  /** The tab that placed the call. */
  callerDeviceId: string;
  answeredBy: string | null;
  answeredDeviceId: string | null;
  status: 'ringing' | 'active' | 'ended';
  endReason: CallEndReason | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}

/** An offer, an answer or an ICE candidate, on its way between the two devices. */
export interface CallSignalData {
  description?: { type: 'offer' | 'answer'; sdp: string };
  candidate?: RTCIceCandidateInit | null;
}

export interface CallSignalPayload {
  callId: string;
  fromDeviceId: string;
  toDeviceId: string;
  data: CallSignalData;
}
