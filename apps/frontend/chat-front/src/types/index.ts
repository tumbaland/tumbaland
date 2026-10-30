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
  /** The uploaded file's name. Set for documents, which are shown by name. */
  name?: string | null;
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

export type PhotoAlbumChoice =
  | { mode: 'off' }
  | { mode: 'album'; albumId: string }
  | { mode: 'album'; newAlbumName: string };

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
  /** The photos unticked on the tray: these stay out of the album, the rest go in. */
  skipAlbumFileIds?: string[];
  effect?: MessageEffect;
  /** The message this answers. */
  replyTo?: string;
}

/** What a reply shows of the message it answers. */
export interface Quote {
  senderId: string;
  senderName: string;
  /** One line of it. Empty once it is unsent. */
  text: string;
  createdAt: string;
  deleted?: boolean;
}

/** "Make a collage together": the collage a card invites the others to. */
export interface CollageCard {
  id: string;
  title: string;
}

/** A plan from the journal that a `reminder` message is about, as it was when it fell due. */
export interface PlanCard {
  id: string;
  title: string;
  /** YYYY-MM-DD, the first day */
  date: string;
  /** YYYY-MM-DD, the last day of a trip; absent or null for one day */
  endDate?: string | null;
  /** HH:mm, null all day */
  time: string | null;
  timeZone: string;
  place: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  kind: 'text' | 'media' | 'system' | 'collage' | 'reminder';
  body: string;
  attachments: Attachment[];
  replyTo: string | null;
  /**
   * On a reply: the message it answers, as it read when the reply was sent,
   * kept up to date by the server. What the quote shows when that message is
   * not loaded. Absent on replies from before quotes were kept.
   */
  quote?: Quote | null;
  /** Absent from a server older than effects. */
  effect?: MessageEffect | null;
  /** On a `collage` message: the collage in Album that "Join" opens. */
  collage?: CollageCard | null;
  /** On a `reminder` message: the plan in the journal that "Open" shows. */
  plan?: PlanCard | null;
  /** The assistant that wrote it, when one did. Its look comes from `AssistantsView.bots`. */
  botId?: string | null;
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
  | 'call.signal'
  | 'live.updated'
  | 'live.ended';

/**
 * Someone sharing where they are, live. Only their newest position, which
 * stops coming whenever their phone's screen is off: `position.at` says how
 * old it is.
 */
export interface LiveShare {
  userId: string;
  name: string;
  position: {
    lat: number;
    lng: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    at: string;
  } | null;
  /** Where they are heading, marked on the map, and how far off it is in a straight line. */
  destination: { lat: number; lng: number; label: string | null; distanceM: number | null } | null;
  /** A pin: one place that stays put, for "come and get me here". Never shown as old. */
  fixed: boolean;
  /** What the pin is: a saved place's name, or the address it is at. */
  pinLabel: string | null;
  startedAt: string;
  /** Four hours from the start at most, as a safety net; never shown. */
  endsAt: string;
  /** Who asked to be told when they are close. Their own point is never sent, only the distance to it. */
  watchers: Array<{ userId: string; name: string; radiusM: number; distanceM: number | null; notified: boolean }>;
}

/** A place found by name, or the address at a point. */
export interface PlaceResult {
  /** "Viru 4", or a place's own name: "Kalev Spa". */
  name: string;
  /** The rest of the address: "Kesklinn, Tallinn, Estonia". */
  detail: string;
  lat: number;
  lng: number;
}

/** A place the group keeps for sharing where one is: "Home". */
export interface SavedPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
}

/** A point picked for sharing, with what to call it. */
export interface PickedPlace {
  lat: number;
  lng: number;
  /** A saved place's name or an address; null until one is known. */
  label: string | null;
}

export interface LivePosition {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface ChatEvent {
  type: ChatEventType;
  conversationId: string;
  at: number;
  payload: unknown;
}

export interface TypingPayload {
  userId: string;
  name: string;
  /** An assistant at work rather than a person typing. */
  bot?: boolean;
  /** What it is doing: "making a collage". Only on an assistant. */
  activity?: string;
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

// ─── Assistants ──────────────────────────────────────────────────────────────

export type ModelId = 'claude-haiku-5-5' | 'claude-sonnet-5-5' | 'claude-opus-5-5';

/** An assistant someone added to the chat. What it was told is readable by everyone. */
export interface Bot {
  id: string;
  name: string;
  personality: string;
  aboutOwner: string;
  color: string;
  model: ModelId;
  /** "Fast", "Balanced" or "Best": people never see a model's name. */
  modelLabel: string;
  paused: boolean;
  /** Now and then speaks up without being asked, on its owner's allowance. */
  joinsIn: boolean;
  ownerId: string;
  ownerName: string;
  /** The viewer made it. */
  mine: boolean;
  /** The viewer may edit, pause or delete it: its owner, and the group's owner and admins. */
  canManage: boolean;
}

/** A person's monthly allowance, as a share. Never money or tokens. */
export interface Allowance {
  /** The plan's limit, or null when it has none. */
  limit: number | null;
  used: number;
  /** Share used, or null with no limit. Can pass 100. */
  percent: number | null;
  /** The person's own lower cap, as a share of the limit. */
  capPercent: number | null;
  /** The next reply would not fit. */
  exhausted: boolean;
  /** YYYY-MM-DD: the first of next month. */
  resetsOn: string;
}

export interface ModelOption {
  id: ModelId;
  label: string;
  name: string;
  hint: string;
}

export interface AssistantPreset {
  id: string;
  name: string;
  personality: string;
}

/** Everything the Assistants dialog shows, for the viewer. */
export interface AssistantsView {
  /** On right now: everyone has agreed and nobody has locked it. */
  enabled: boolean;
  lockedOff: boolean;
  whoCanAdd: 'everyone' | 'admins';
  aboutUs: string;
  /** What the assistants have noted about you, a note to a line. Anyone here can edit it. */
  memory: string;
  /** The assistants may add notes. Off, they still read what is there. */
  memoryOn: boolean;
  /** The viewer is an owner or admin of the group. */
  isManager: boolean;
  /** The viewer may add a bot. */
  canAdd: boolean;
  bots: Bot[];
  presets: AssistantPreset[];
  colors: string[];
  models: { options: ModelOption[]; default: ModelId };
  allowance: Allowance;
}

export interface BotInput {
  name: string;
  personality?: string;
  aboutOwner?: string;
  color?: string;
  model?: ModelId;
}

export type BotChange = Partial<BotInput> & { paused?: boolean; joinsIn?: boolean };

export interface AssistantSettingsChange {
  enabled?: boolean;
  aboutUs?: string;
  memory?: string;
  memoryOn?: boolean;
  lockedOff?: boolean;
  whoCanAdd?: 'everyone' | 'admins';
}
