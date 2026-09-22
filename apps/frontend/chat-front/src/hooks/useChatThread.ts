import { useCallback, useEffect, useInsertionEffect, useMemo, useReducer, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi, newClientId } from '../services/chatApi';
import { initialThreadState, lastStoredMessage, threadReducer } from './threadReducer';
import { useChatStream, type ConnectionState } from './useChatStream';
import { namesTyping, useTypingTracker } from './useTypingTracker';
import type {
  Attachment,
  ChatEvent,
  ConversationMember,
  AlbumPlacement,
  Message,
  PhotoAlbum,
  PhotoAlbumChoice,
  Presence,
  ReadPayload,
  ReadReceipt,
  ThreadMessage,
  TypingPayload
} from '../types';

const UNSET_ALBUM: PhotoAlbum = { mode: 'unset', albumId: null, albumName: null };

/** Minimum gap between typing notices sent while someone types continuously. */
const TYPING_THROTTLE_MS = 2500;

export interface UseChatThreadResult {
  messages: ThreadMessage[];
  loading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  error: string | null;
  connection: ConnectionState;
  typingNames: string[];
  /** Everyone who has opened the conversation, with their pictures. */
  members: ConversationMember[];
  /** How far each of the others has read, by user id. Never includes the caller. */
  reads: Record<string, ReadReceipt>;
  /** Who of the others is online, by user id. Never includes the caller. */
  presence: Record<string, Presence>;
  /** The conversation's own title, when it has one. */
  title: string;
  /** Where this conversation's photos go in Album. */
  photoAlbum: PhotoAlbum;
  setPhotoAlbum: (choice: PhotoAlbumChoice) => Promise<void>;
  removeFromAlbum: (messageId: string, fileId?: string) => Promise<void>;
  placeInAlbum: (messageId: string, placement: AlbumPlacement, fileId?: string) => Promise<void>;
  send: (body: string, attachments?: Attachment[], options?: { skipAlbum?: boolean }) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  react: (messageId: string, emoji: string) => Promise<void>;
  edit: (messageId: string, body: string) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
  notifyTyping: () => void;
}

export function useChatThread(conversationId: string | undefined, currentUserId: string): UseChatThreadResult {
  const [state, dispatch] = useReducer(threadReducer, initialThreadState);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const { typing, note: noteTyping, clear: clearTyping } = useTypingTracker();
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [reads, setReads] = useState<Record<string, ReadReceipt>>({});
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [title, setTitle] = useState('');
  const [photoAlbum, setPhotoAlbumState] = useState<PhotoAlbum>(UNSET_ALBUM);

  // The stream handler is created once and reads the current conversation from
  // this ref, so switching threads does not rebuild the connection. Written in
  // an insertion effect so a discarded render cannot leave a stale value.
  const conversationRef = useRef(conversationId);
  useInsertionEffect(() => {
    conversationRef.current = conversationId;
  });
  const lastTypingSent = useRef(0);
  /** Bodies kept by clientId so a failed send can be retried unchanged. */
  const outbox = useRef(new Map<string, { body: string; attachments: Attachment[]; skipAlbum: boolean }>());

  const load = useCallback(async () => {
    if (!conversationId) return;
    dispatch({ type: 'loading' });

    // Alongside the messages, not before them: the thread is readable without
    // pictures and read markers, so a slow or failed call here must not hold
    // it up. Also re-run on every resync, which is how a read that happened
    // while this device was offline gets its marker.
    void chatApi
      .getConversation(conversationId)
      .then((detail) => {
        if (conversationRef.current !== conversationId) return;
        setMembers(detail.members);
        setTitle(detail.title ?? '');
        setPhotoAlbumState(detail.photoAlbum ?? UNSET_ALBUM);
        setPresence(Object.fromEntries((detail.presence ?? []).map((entry) => [entry.userId, entry])));
        setReads(
          Object.fromEntries(
            detail.reads.filter((read) => read.userId !== currentUserId).map((read) => [read.userId, read])
          )
        );
      })
      .catch((error: Error) => logger.warn('Could not load conversation details', { error: error.message }));

    try {
      const page = await chatApi.listMessages(conversationId, { limit: 50 });
      dispatch({ type: 'loaded', messages: page.messages, nextCursor: page.nextCursor });
    } catch (error) {
      dispatch({ type: 'failed', error: (error as Error).message });
    }
  }, [conversationId, currentUserId]);

  // Another thread's markers and pictures must not show while this one loads.
  useEffect(() => {
    setMembers([]);
    setReads({});
    setPresence({});
    setTitle('');
    setPhotoAlbumState(UNSET_ALBUM);
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadOlder = useCallback(async () => {
    const cursor = state.nextCursor;
    if (!conversationId || !cursor || state.loadingOlder) return;

    dispatch({ type: 'loadingOlder' });
    try {
      const page = await chatApi.listMessages(conversationId, { before: cursor, limit: 50 });
      dispatch({ type: 'olderLoaded', messages: page.messages, nextCursor: page.nextCursor });
    } catch (error) {
      dispatch({ type: 'failed', error: (error as Error).message });
    }
  }, [conversationId, state.nextCursor, state.loadingOlder]);

  /** Events for other conversations are ignored; one stream serves them all. */
  const onEvent = useCallback(
    (event: ChatEvent) => {
      // About a person rather than a conversation, so it is taken before the
      // conversation filter below. Kept for anyone; the header reads only this
      // thread's members.
      if (event.type === 'presence') {
        const payload = event.payload as Presence;
        if (payload.userId === currentUserId) return;
        setPresence((previous) => ({ ...previous, [payload.userId]: payload }));
        return;
      }

      const current = conversationRef.current;
      if (!current || (event.conversationId && event.conversationId !== current)) return;

      switch (event.type) {
        case 'message.created': {
          const message = event.payload as Message;
          dispatch({ type: 'received', message });
          // Sending is the end of typing; the dots must not outlast the message.
          clearTyping(current, message.senderId);
          // Someone who writes has read everything before it.
          if (message.senderId !== currentUserId) {
            setReads((previous) => ({
              ...previous,
              [message.senderId]: { userId: message.senderId, lastReadMessageId: message.id, lastReadAt: message.createdAt }
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
          // Someone changed where photos go, or the album was deleted.
          const payload = event.payload as { photoAlbum?: PhotoAlbum } | null;
          if (payload?.photoAlbum) setPhotoAlbumState(payload.photoAlbum);
          break;
        }
        case 'typing': {
          const payload = event.payload as TypingPayload;
          if (payload.userId === currentUserId) return;
          noteTyping(current, payload.userId, payload.name);
          break;
        }
        case 'read': {
          const payload = event.payload as ReadPayload;
          if (payload.userId === currentUserId) return;
          setReads((previous) => ({
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
    },
    [currentUserId, noteTyping, clearTyping]
  );

  useChatStream({ onEvent, onResync: load, onStateChange: setConnection });

  // Marking read is driven by the newest stored message rather than by a
  // scroll position: the thread is only rendered when it is on screen, and a
  // scroll-based cursor misfires on a short thread that never scrolls.
  const newest = lastStoredMessage(state.messages);
  const newestId = newest?.id;
  useEffect(() => {
    if (!conversationId || !newestId || document.visibilityState === 'hidden') return;
    void chatApi.markRead(conversationId, newestId).catch(() => {
      // A missed read receipt self-corrects on the next message.
    });
  }, [conversationId, newestId]);

  const deliver = useCallback(
    async (clientId: string, body: string, attachments: Attachment[], skipAlbum = false) => {
      if (!conversationId) return;
      try {
        const stored = await chatApi.sendMessage(conversationId, {
          clientId,
          body,
          attachments,
          ...(skipAlbum ? { skipAlbum } : {})
        });
        dispatch({ type: 'confirmed', clientId, message: stored });
        outbox.current.delete(clientId);
      } catch (error) {
        logger.warn('Chat send failed', { error: (error as Error).message });
        dispatch({ type: 'sendFailed', clientId });
      }
    },
    [conversationId]
  );

  const send = useCallback(
    async (body: string, attachments: Attachment[] = [], options: { skipAlbum?: boolean } = {}) => {
      if (!conversationId) return;
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) return;

      const clientId = newClientId();
      const skipAlbum = Boolean(options.skipAlbum);
      outbox.current.set(clientId, { body: trimmed, attachments, skipAlbum });

      // Shown immediately, with the id it will keep. The server's copy
      // replaces it by clientId, so it never appears twice and never jumps.
      dispatch({
        type: 'optimistic',
        message: {
          id: `pending-${clientId}`,
          conversationId,
          senderId: currentUserId,
          senderEmail: '',
          senderName: '',
          kind: attachments.length > 0 ? 'media' : 'text',
          body: trimmed,
          attachments,
          replyTo: null,
          reactions: [],
          clientId,
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          delivery: 'pending'
        }
      });

      await deliver(clientId, trimmed, attachments, skipAlbum);
    },
    [conversationId, currentUserId, deliver]
  );

  /**
   * Retries a failed send with the *same* clientId, which is what makes a
   * retry safe: if the original in fact reached the server, this returns that
   * message rather than posting a second one.
   */
  const retry = useCallback(
    async (clientId: string) => {
      const queued = outbox.current.get(clientId);
      if (!queued) return;
      dispatch({
        type: 'optimistic',
        message: {
          id: `pending-${clientId}`,
          conversationId: conversationId!,
          senderId: currentUserId,
          senderEmail: '',
          senderName: '',
          kind: queued.attachments.length > 0 ? 'media' : 'text',
          body: queued.body,
          attachments: queued.attachments,
          replyTo: null,
          reactions: [],
          clientId,
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          delivery: 'pending'
        }
      });
      await deliver(clientId, queued.body, queued.attachments, queued.skipAlbum);
    },
    [conversationId, currentUserId, deliver]
  );

  const react = useCallback(
    async (messageId: string, emoji: string) => {
      if (!conversationId) return;
      try {
        const updated = await chatApi.toggleReaction(conversationId, messageId, emoji);
        dispatch({ type: 'updated', message: updated });
      } catch (error) {
        logger.warn('Reaction failed', { error: (error as Error).message });
      }
    },
    [conversationId]
  );

  const edit = useCallback(
    async (messageId: string, body: string) => {
      if (!conversationId) return;
      const updated = await chatApi.editMessage(conversationId, messageId, body);
      dispatch({ type: 'updated', message: updated });
    },
    [conversationId]
  );

  const remove = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;
      await chatApi.deleteMessage(conversationId, messageId);
      dispatch({ type: 'removed', id: messageId });
    },
    [conversationId]
  );

  const setPhotoAlbum = useCallback(
    async (choice: PhotoAlbumChoice) => {
      if (!conversationId) return;
      setPhotoAlbumState(await chatApi.setPhotoAlbum(conversationId, choice));
    },
    [conversationId]
  );

  // Both answer with the updated message, which is shown straight away; the
  // stream brings the same change to everyone else.
  const removeFromAlbum = useCallback(
    async (messageId: string, fileId?: string) => {
      if (!conversationId) return;
      dispatch({ type: 'updated', message: await chatApi.removeFromAlbum(conversationId, messageId, fileId) });
    },
    [conversationId]
  );

  const placeInAlbum = useCallback(
    async (messageId: string, placement: AlbumPlacement, fileId?: string) => {
      if (!conversationId) return;
      dispatch({ type: 'updated', message: await chatApi.placeInAlbum(conversationId, messageId, placement, fileId) });
    },
    [conversationId]
  );

  /** Throttled: typing fires per keystroke, the network should not. */
  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    void chatApi.sendTyping(conversationId);
  }, [conversationId]);

  const typingNames = useMemo(() => namesTyping(typing, conversationId), [typing, conversationId]);

  return {
    messages: state.messages,
    loading: state.loading,
    loadingOlder: state.loadingOlder,
    hasOlder: Boolean(state.nextCursor),
    error: state.error,
    connection,
    typingNames,
    members,
    reads,
    presence,
    title,
    photoAlbum,
    setPhotoAlbum,
    removeFromAlbum,
    placeInAlbum,
    send,
    retry,
    loadOlder,
    react,
    edit,
    remove,
    notifyTyping
  };
}
