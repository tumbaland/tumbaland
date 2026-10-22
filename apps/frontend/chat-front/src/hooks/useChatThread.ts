import { useCallback, useEffect, useInsertionEffect, useMemo, useReducer, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi, newClientId } from '../services/chatApi';
import { messageSummary } from '../services/summary';
import { initialThreadState, lastStoredMessage, threadReducer } from './threadReducer';
import { useChatStream, type ConnectionState } from './useChatStream';
import { namesTyping, useTypingTracker } from './useTypingTracker';
import type {
  Attachment,
  ChatEvent,
  ConversationMember,
  AlbumPlacement,
  Appearance,
  LiveShare,
  Message,
  MessagePage,
  PhotoAlbum,
  PhotoAlbumChoice,
  Quote,
  Presence,
  ReadPayload,
  ReadReceipt,
  SendOptions,
  ThreadMessage,
  TypingPayload
} from '../types';

const UNSET_ALBUM: PhotoAlbum = { mode: 'unset', albumId: null, albumName: null };
const DEFAULT_APPEARANCE: Appearance = { theme: 'classic', backgroundFileId: null, backgroundUrl: null };

/** Minimum gap between typing notices sent while someone types continuously. */
const TYPING_THROTTLE_MS = 2500;

/**
 * Takes this conversation's message notification down on this device once it
 * has been read here. Message pushes are tagged with the conversation id.
 */
function closeNotifications(conversationId: string): void {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker
    .getRegistration()
    .then((registration) => registration?.getNotifications({ tag: conversationId }))
    .then((notifications) => notifications?.forEach((notification) => notification.close()))
    .catch(() => undefined);
}

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
  /** How the thread looks, for everyone in it. */
  appearance: Appearance;
  /** Who is sharing where they are, live, the caller included. */
  live: LiveShare[];
  /** A share as an API call answered with it, ahead of the stream; null `share` drops `userId`'s. */
  setLiveShare: (userId: string, share: LiveShare | null) => void;
  setAppearance: (change: { theme?: string; backgroundFileId?: string | null }) => Promise<void>;
  setPhotoAlbum: (choice: PhotoAlbumChoice) => Promise<void>;
  /**
   * Makes a collage on the chat's album and posts its card; answers with the
   * card. `clientId` is kept across retries, so a retry cannot make a second.
   */
  startCollage: (title: string, clientId: string) => Promise<Message | null>;
  /** Some of a message's photos (`fileIds`), or all of them. */
  removeFromAlbum: (messageId: string, fileIds?: string[]) => Promise<void>;
  placeInAlbum: (messageId: string, placement: AlbumPlacement, fileIds?: string[]) => Promise<void>;
  send: (body: string, attachments?: Attachment[], options?: SendOptions) => Promise<void>;
  retry: (clientId: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  /**
   * Loads older pages until the message is in the thread, for opening a
   * search result. `gone` when it was unsent since; `too-far` past the limit.
   */
  loadUntil: (messageId: string, createdAt: string) => Promise<'found' | 'gone' | 'too-far'>;
  react: (messageId: string, emoji: string) => Promise<void>;
  edit: (messageId: string, body: string) => Promise<void>;
  remove: (messageId: string) => Promise<void>;
  notifyTyping: () => void;
}

/**
 * How far back opening a search result will load: 30 pages of 100. Every
 * message loaded is a bubble on the page, and a result from years back would
 * otherwise pull the whole history onto a phone to show one line.
 */
const JUMP_PAGE_SIZE = 100;

/** How often a thread with someone sharing live asks for their position, beside the stream. */
const LIVE_REFRESH_MS = 20_000;
const JUMP_MAX_PAGES = 30;

export function useChatThread(conversationId: string | undefined, currentUserId: string): UseChatThreadResult {
  const [state, dispatch] = useReducer(threadReducer, initialThreadState);
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const { typing, note: noteTyping, clear: clearTyping } = useTypingTracker();
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [reads, setReads] = useState<Record<string, ReadReceipt>>({});
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [title, setTitle] = useState('');
  const [photoAlbum, setPhotoAlbumState] = useState<PhotoAlbum>(UNSET_ALBUM);
  const [appearance, setAppearanceState] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [live, setLive] = useState<LiveShare[]>([]);
  const liveRevision = useRef(0);
  const setLiveShare = useCallback((userId: string, share: LiveShare | null) => {
    liveRevision.current += 1;
    setLive((current) => [...current.filter((entry) => entry.userId !== userId), ...(share ? [share] : [])]);
  }, []);

  // The stream handler is created once and reads the current conversation from
  // this ref, so switching threads does not rebuild the connection. Written in
  // an insertion effect so a discarded render cannot leave a stale value.
  const conversationRef = useRef(conversationId);
  useInsertionEffect(() => {
    conversationRef.current = conversationId;
  });
  const refreshLive = useCallback(() => {
    if (!conversationId) return;
    const revision = liveRevision.current;
    void chatApi
      .listLive(conversationId)
      .then((shares) => {
        // A snapshot requested before a stream event or a local stop must not undo it.
        if (conversationRef.current === conversationId && liveRevision.current === revision) {
          liveRevision.current += 1;
          setLive(shares);
        }
      })
      .catch(() => undefined);
  }, [conversationId]);
  const lastTypingSent = useRef(0);
  /** Bodies kept by clientId so a failed send can be retried unchanged. */
  const outbox = useRef(
    new Map<string, { body: string; attachments: Attachment[]; options: SendOptions; quote: Quote | null }>()
  );

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
        setAppearanceState(detail.appearance ?? DEFAULT_APPEARANCE);
        setPresence(Object.fromEntries((detail.presence ?? []).map((entry) => [entry.userId, entry])));
        setReads(
          Object.fromEntries(
            detail.reads.filter((read) => read.userId !== currentUserId).map((read) => [read.userId, read])
          )
        );
      })
      .catch((error: Error) => logger.warn('Could not load conversation details', { error: error.message }));

    refreshLive();

    try {
      const page = await chatApi.listMessages(conversationId, { limit: 50 });
      dispatch({ type: 'loaded', messages: page.messages, nextCursor: page.nextCursor });
    } catch (error) {
      dispatch({ type: 'failed', error: (error as Error).message });
    }
  }, [conversationId, currentUserId, refreshLive]);

  // Another thread's markers and pictures must not show while this one loads.
  useEffect(() => {
    setMembers([]);
    setReads({});
    setPresence({});
    setTitle('');
    setPhotoAlbumState(UNSET_ALBUM);
    setAppearanceState(DEFAULT_APPEARANCE);
    setLive([]);
    liveRevision.current += 1;
  }, [conversationId]);

  // While someone is sharing, asked again now and then as well as told by the
  // stream: a stream that fell back to polling carries no live events, and a
  // position that stops arriving should still be seen to age.
  const sharing = live.length > 0;
  useEffect(() => {
    if (!conversationId || !sharing) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshLive();
    }, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [conversationId, sharing, refreshLive]);

  // Expiry also closes an open viewer; the banner alone hiding it would leave its map up.
  useEffect(() => {
    if (!live.length) return;
    const nextEnd = Math.min(...live.map((share) => new Date(share.endsAt).getTime()));
    const timer = setTimeout(
      () => {
        liveRevision.current += 1;
        setLive((current) => current.filter((share) => new Date(share.endsAt).getTime() > Date.now()));
      },
      Math.min(2_147_483_647, Math.max(0, nextEnd - Date.now()))
    );
    return () => clearTimeout(timer);
  }, [live]);

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

  // Read by loadUntil, whose loop outlives the render it started in.
  const latestState = useRef(state);
  useInsertionEffect(() => {
    latestState.current = state;
  });

  const loadUntil = useCallback(
    async (messageId: string, createdAt: string): Promise<'found' | 'gone' | 'too-far'> => {
      if (!conversationId) return 'gone';
      if (latestState.current.messages.some((message) => message.id === messageId)) return 'found';

      const target = new Date(createdAt).getTime();
      let cursor = latestState.current.nextCursor;
      for (let page = 0; cursor && page < JUMP_MAX_PAGES; page++) {
        if (conversationRef.current !== conversationId) return 'gone';
        dispatch({ type: 'loadingOlder' });
        let result: MessagePage;
        try {
          result = await chatApi.listMessages(conversationId, { before: cursor, limit: JUMP_PAGE_SIZE });
        } catch (error) {
          // Settles the spinner without an error banner over the thread; the
          // caller says what went wrong.
          dispatch({ type: 'olderLoaded', messages: [], nextCursor: cursor });
          throw error;
        }
        dispatch({ type: 'olderLoaded', messages: result.messages, nextCursor: result.nextCursor });
        if (result.messages.some((message) => message.id === messageId)) return 'found';

        // Walked past where it was without finding it: unsent since the search.
        const oldest = result.messages[result.messages.length - 1];
        if (oldest && new Date(oldest.createdAt).getTime() < target) return 'gone';
        cursor = result.nextCursor;
      }
      return cursor ? 'too-far' : 'gone';
    },
    [conversationId]
  );

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
          } | null;
          if (payload?.photoAlbum) setPhotoAlbumState(payload.photoAlbum);
          if (payload?.appearance) setAppearanceState(payload.appearance);
          const changed = payload?.member;
          if (changed) {
            setMembers((previous) =>
              previous.map((member) =>
                member.userId === changed.userId ? { ...member, name: changed.name, picture: changed.picture } : member
              )
            );
          }
          break;
        }
        case 'live.updated': {
          const share = event.payload as LiveShare;
          setLiveShare(share.userId, share);
          break;
        }
        case 'live.ended': {
          const { userId } = event.payload as { userId: string };
          setLiveShare(userId, null);
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
    [currentUserId, noteTyping, clearTyping, setLiveShare]
  );

  useChatStream({ onEvent, onResync: load, onStateChange: setConnection });

  // Marking read is driven by the newest stored message rather than by a
  // scroll position: the thread is only rendered when it is on screen, and a
  // scroll-based cursor misfires on a short thread that never scrolls.
  const newest = lastStoredMessage(state.messages);
  const newestId = newest?.id;
  //
  // Also runs when the page comes back on screen: a message that arrived while
  // it was hidden was not read then, and without this it stayed unread (and
  // kept its notification) until the next message moved the cursor.
  useEffect(() => {
    if (!conversationId || !newestId) return;

    const markRead = () => {
      if (document.visibilityState === 'hidden') return;
      void chatApi.markRead(conversationId, newestId).catch(() => {
        // A missed read receipt self-corrects on the next message.
      });
      closeNotifications(conversationId);
    };

    markRead();
    document.addEventListener('visibilitychange', markRead);
    return () => document.removeEventListener('visibilitychange', markRead);
  }, [conversationId, newestId]);

  const deliver = useCallback(
    async (clientId: string, body: string, attachments: Attachment[], options: SendOptions) => {
      if (!conversationId) return;
      const { skipAlbum, skipAlbumFileIds, effect, replyTo } = options;
      try {
        const stored = await chatApi.sendMessage(conversationId, {
          clientId,
          body,
          attachments,
          ...(skipAlbum ? { skipAlbum } : {}),
          ...(skipAlbumFileIds?.length ? { skipAlbumFileIds } : {}),
          ...(effect ? { effect } : {}),
          ...(replyTo ? { replyTo } : {})
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
    async (body: string, attachments: Attachment[] = [], options: SendOptions = {}) => {
      if (!conversationId) return;
      const trimmed = body.trim();
      if (!trimmed && attachments.length === 0) return;

      const clientId = newClientId();
      const { effect, replyTo } = options;
      // Drawn from the message on screen until the server's copy arrives.
      const parent = replyTo ? latestState.current.messages.find((message) => message.id === replyTo) : undefined;
      const quote: Quote | null = parent
        ? {
            senderId: parent.senderId,
            senderName: parent.senderName,
            text: messageSummary(parent),
            createdAt: parent.createdAt
          }
        : null;
      outbox.current.set(clientId, { body: trimmed, attachments, options, quote });

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
          replyTo: replyTo ?? null,
          quote,
          effect: effect ?? null,
          reactions: [],
          clientId,
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          delivery: 'pending'
        }
      });

      await deliver(clientId, trimmed, attachments, options);
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
          replyTo: queued.options.replyTo ?? null,
          quote: queued.quote,
          effect: queued.options.effect ?? null,
          reactions: [],
          clientId,
          editedAt: null,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          delivery: 'pending'
        }
      });
      await deliver(clientId, queued.body, queued.attachments, queued.options);
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

  const startCollage = useCallback(
    async (title: string, clientId: string) => {
      if (!conversationId) return null;
      const message = await chatApi.startCollage(conversationId, { clientId, title });
      dispatch({ type: 'received', message });
      return message;
    },
    [conversationId]
  );

  // Both answer with the updated message, which is shown straight away; the
  // stream brings the same change to everyone else.
  const setAppearance = useCallback(
    async (change: { theme?: string; backgroundFileId?: string | null }) => {
      if (!conversationId) return;
      setAppearanceState(await chatApi.setAppearance(conversationId, change));
    },
    [conversationId]
  );

  const removeFromAlbum = useCallback(
    async (messageId: string, fileIds?: string[]) => {
      if (!conversationId) return;
      dispatch({ type: 'updated', message: await chatApi.removeFromAlbum(conversationId, messageId, fileIds) });
    },
    [conversationId]
  );

  const placeInAlbum = useCallback(
    async (messageId: string, placement: AlbumPlacement, fileIds?: string[]) => {
      if (!conversationId) return;
      dispatch({ type: 'updated', message: await chatApi.placeInAlbum(conversationId, messageId, placement, fileIds) });
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
    live,
    setLiveShare,
    setPhotoAlbum,
    startCollage,
    appearance,
    setAppearance,
    removeFromAlbum,
    placeInAlbum,
    send,
    retry,
    loadOlder,
    loadUntil,
    react,
    edit,
    remove,
    notifyTyping
  };
}
