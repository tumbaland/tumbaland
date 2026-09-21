import { useCallback, useEffect, useInsertionEffect, useMemo, useReducer, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi, newClientId } from '../services/chatApi';
import { initialThreadState, lastStoredMessage, threadReducer } from './threadReducer';
import { useChatStream, type ConnectionState } from './useChatStream';
import type { Attachment, ChatEvent, Message, ReadPayload, ThreadMessage, TypingPayload } from '../types';

/** How long a typing indicator stays up without another notice. */
const TYPING_TIMEOUT_MS = 4000;

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
  /** Who has read up to the latest stored message, excluding the caller. */
  readBy: string[];
  send: (body: string, attachments?: Attachment[]) => Promise<void>;
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
  const [typing, setTyping] = useState<Record<string, { name: string; at: number }>>({});
  const [readBy, setReadBy] = useState<string[]>([]);

  // The stream handler is created once and reads the current conversation from
  // this ref, so switching threads does not rebuild the connection. Written in
  // an insertion effect so a discarded render cannot leave a stale value.
  const conversationRef = useRef(conversationId);
  useInsertionEffect(() => {
    conversationRef.current = conversationId;
  });
  const lastTypingSent = useRef(0);
  /** Bodies kept by clientId so a failed send can be retried unchanged. */
  const outbox = useRef(new Map<string, { body: string; attachments: Attachment[] }>());

  const load = useCallback(async () => {
    if (!conversationId) return;
    dispatch({ type: 'loading' });
    try {
      const page = await chatApi.listMessages(conversationId, { limit: 50 });
      dispatch({ type: 'loaded', messages: page.messages, nextCursor: page.nextCursor });
    } catch (error) {
      dispatch({ type: 'failed', error: (error as Error).message });
    }
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
      const current = conversationRef.current;
      if (!current || (event.conversationId && event.conversationId !== current)) return;

      switch (event.type) {
        case 'message.created':
          dispatch({ type: 'received', message: event.payload as Message });
          break;
        case 'message.updated':
        case 'reaction.updated':
          dispatch({ type: 'updated', message: event.payload as Message });
          break;
        case 'message.deleted':
          dispatch({ type: 'removed', id: (event.payload as { id: string }).id });
          break;
        case 'typing': {
          const payload = event.payload as TypingPayload;
          if (payload.userId === currentUserId) return;
          setTyping((previous) => ({ ...previous, [payload.userId]: { name: payload.name, at: Date.now() } }));
          break;
        }
        case 'read': {
          const payload = event.payload as ReadPayload;
          if (payload.userId === currentUserId) return;
          setReadBy((previous) => (previous.includes(payload.name) ? previous : [...previous, payload.name]));
          break;
        }
        default:
          break;
      }
    },
    [currentUserId]
  );

  useChatStream({ onEvent, onResync: load, onStateChange: setConnection });

  // Typing indicators expire on a timer rather than on a "stopped" event:
  // the sender may close the tab mid-word, and an indicator that never clears
  // is worse than one that clears early.
  useEffect(() => {
    if (Object.keys(typing).length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - TYPING_TIMEOUT_MS;
      setTyping((previous) => {
        const next = Object.fromEntries(Object.entries(previous).filter(([, value]) => value.at > cutoff));
        return Object.keys(next).length === Object.keys(previous).length ? previous : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [typing]);

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
    async (clientId: string, body: string, attachments: Attachment[]) => {
      if (!conversationId) return;
      try {
        const stored = await chatApi.sendMessage(conversationId, { clientId, body, attachments });
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
    async (body: string, attachments: Attachment[] = []) => {
      if (!conversationId) return;
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) return;

      const clientId = newClientId();
      outbox.current.set(clientId, { body: trimmed, attachments });

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

      await deliver(clientId, trimmed, attachments);
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
      await deliver(clientId, queued.body, queued.attachments);
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

  /** Throttled: typing fires per keystroke, the network should not. */
  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    void chatApi.sendTyping(conversationId);
  }, [conversationId]);

  const typingNames = useMemo(() => Object.values(typing).map((entry) => entry.name), [typing]);

  return {
    messages: state.messages,
    loading: state.loading,
    loadingOlder: state.loadingOlder,
    hasOlder: Boolean(state.nextCursor),
    error: state.error,
    connection,
    typingNames,
    readBy,
    send,
    retry,
    loadOlder,
    react,
    edit,
    remove,
    notifyTyping
  };
}
