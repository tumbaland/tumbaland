import type { Dispatch, SetStateAction } from 'react';
import type { ThreadAction } from './threadReducer';
import type {
  Appearance,
  ChatEvent,
  ConversationMember,
  LiveShare,
  Message,
  PhotoAlbum,
  Presence,
  ReadPayload,
  ReadReceipt,
  TypingPayload
} from '../types';

/** What a stream event is allowed to change, and who is reading it. */
export interface ThreadEventContext {
  /** The conversation on screen now; null when none is. */
  conversationId: string | undefined;
  currentUserId: string;
  dispatch: Dispatch<ThreadAction>;
  setReads: Dispatch<SetStateAction<Record<string, ReadReceipt>>>;
  setPresence: Dispatch<SetStateAction<Record<string, Presence>>>;
  setMembers: Dispatch<SetStateAction<ConversationMember[]>>;
  setPhotoAlbum: (album: PhotoAlbum) => void;
  setAppearance: (appearance: Appearance) => void;
  setLiveShare: (userId: string, share: LiveShare | null) => void;
  noteTyping: (conversationId: string, userId: string, name: string, extra?: { bot?: boolean; activity?: string }) => void;
  /** The assistants' settings or bots changed: reload what the dialog and the `@` list show. */
  refreshAssistants: () => void;
  clearTyping: (conversationId: string, userId: string) => void;
}

/**
 * Applies one stream event to the open thread. Events for other conversations
 * are ignored: one stream serves them all.
 */
export function handleThreadEvent(event: ChatEvent, ctx: ThreadEventContext): void {
  const { currentUserId, dispatch } = ctx;

  // About a person rather than a conversation, so it is taken before the
  // conversation filter below. Kept for anyone; the header reads only this
  // thread's members.
  if (event.type === 'presence') {
    const payload = event.payload as Presence;
    if (payload.userId === currentUserId) return;
    ctx.setPresence((previous) => ({ ...previous, [payload.userId]: payload }));
    return;
  }

  const current = ctx.conversationId;
  if (!current || (event.conversationId && event.conversationId !== current)) return;

  switch (event.type) {
    case 'message.created': {
      const message = event.payload as Message;
      dispatch({ type: 'received', message });
      // Sending is the end of typing; the dots must not outlast the message.
      ctx.clearTyping(current, message.senderId);
      // Someone who writes has read everything before it.
      if (message.senderId !== currentUserId) {
        ctx.setReads((previous) => ({
          ...previous,
          [message.senderId]: {
            userId: message.senderId,
            lastReadMessageId: message.id,
            lastReadAt: message.createdAt
          }
        }));
      }
      break;
    }
    case 'message.updated':
    case 'reaction.updated':
      dispatch({ type: 'updated', message: event.payload as Message });
      break;
    case 'message.deleted':
      dispatch({ type: 'removed', id: (event.payload as { id: string }).id });
      break;
    case 'conversation.updated': {
      // Someone changed where photos go or how the thread looks, the
      // album or background photo went away, or someone renamed themselves.
      const payload = event.payload as {
        photoAlbum?: PhotoAlbum;
        appearance?: Appearance;
        member?: Pick<ConversationMember, 'userId' | 'name' | 'picture'>;
        assistants?: boolean;
      } | null;
      if (payload?.assistants) ctx.refreshAssistants();
      if (payload?.photoAlbum) ctx.setPhotoAlbum(payload.photoAlbum);
      if (payload?.appearance) ctx.setAppearance(payload.appearance);
      const changed = payload?.member;
      if (changed) {
        ctx.setMembers((previous) =>
          previous.map((member) =>
            member.userId === changed.userId ? { ...member, name: changed.name, picture: changed.picture } : member
          )
        );
      }
      break;
    }
    case 'live.updated': {
      const share = event.payload as LiveShare;
      ctx.setLiveShare(share.userId, share);
      break;
    }
    case 'live.ended': {
      const { userId } = event.payload as { userId: string };
      ctx.setLiveShare(userId, null);
      break;
    }
    case 'typing': {
      const payload = event.payload as TypingPayload;
      if (payload.userId === currentUserId) return;
      if (payload.bot) ctx.noteTyping(current, payload.userId, payload.name, { bot: true, activity: payload.activity });
      else ctx.noteTyping(current, payload.userId, payload.name);
      break;
    }
    case 'read': {
      const payload = event.payload as ReadPayload;
      if (payload.userId === currentUserId) return;
      ctx.setReads((previous) => ({
        ...previous,
        [payload.userId]: {
          userId: payload.userId,
          lastReadMessageId: payload.lastReadMessageId,
          lastReadAt: payload.lastReadAt ?? new Date(event.at).toISOString()
        }
      }));
      break;
    }
    default:
      break;
  }
}
