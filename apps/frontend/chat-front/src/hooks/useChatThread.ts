import { useCallback, useEffect, useInsertionEffect, useMemo, useReducer, useRef, useState } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi } from '../services/chatApi';
import { initialThreadState, lastStoredMessage, threadReducer } from './threadReducer';
import { useChatStream, type ConnectionState } from './useChatStream';
import { assistantsWorking, namesTyping, useTypingTracker, type AssistantAtWork } from './useTypingTracker';
import { handleThreadEvent } from './threadEvents';
import { useMarkRead } from './useMarkRead';
import { useThreadActions } from './useThreadActions';
import { useThreadAssistants } from './useThreadAssistants';
import { useThreadLive } from './useThreadLive';
import { useThreadPaging } from './useThreadPaging';
import { useThreadSend } from './useThreadSend';
import type {
  Attachment,
  ChatEvent,
  ConversationMember,
  AlbumPlacement,
  AssistantsView,
  Appearance,
  LiveShare,
  Message,
  PhotoAlbum,
  PhotoAlbumChoice,
  Presence,
  ReadReceipt,
  SendOptions,
  ThreadMessage
} from '../types';

const UNSET_ALBUM: PhotoAlbum = { mode: 'unset', albumId: null, albumName: null };
const DEFAULT_APPEARANCE: Appearance = { theme: 'classic', backgroundFileId: null, backgroundUrl: null };

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
  /** Assistants answering right now, and what each is doing. */
  assistantsWorking: AssistantAtWork[];
  /** The assistants and bots here, as the viewer sees them; null until loaded. */
  assistants: AssistantsView | null;
  refreshAssistants: () => void;
  assistantActions: ReturnType<typeof useThreadAssistants>['assistantActions'];
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

  // The stream handler is created once and reads the current conversation from
  // this ref, so switching threads does not rebuild the connection. Written in
  // an insertion effect so a discarded render cannot leave a stale value.
  const conversationRef = useRef(conversationId);
  useInsertionEffect(() => {
    conversationRef.current = conversationId;
  });
  const { live, setLiveShare, refreshLive } = useThreadLive(conversationId, conversationRef);
  const { assistants, refreshAssistants, assistantActions } = useThreadAssistants(conversationId, conversationRef);
  const lastTypingSent = useRef(0);

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
    refreshAssistants();

    try {
      const page = await chatApi.listMessages(conversationId, { limit: 50 });
      dispatch({ type: 'loaded', messages: page.messages, nextCursor: page.nextCursor });
    } catch (error) {
      dispatch({ type: 'failed', error: (error as Error).message });
    }
  }, [conversationId, currentUserId, refreshLive, refreshAssistants]);

  // Another thread's markers and pictures must not show while this one loads.
  useEffect(() => {
    setMembers([]);
    setReads({});
    setPresence({});
    setTitle('');
    setPhotoAlbumState(UNSET_ALBUM);
    setAppearanceState(DEFAULT_APPEARANCE);
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Read by the paging and send hooks, whose work outlives the render it started in.
  const latestState = useRef(state);
  useInsertionEffect(() => {
    latestState.current = state;
  });

  const { loadOlder, loadUntil } = useThreadPaging(conversationId, state, latestState, conversationRef, dispatch);

  const onEvent = useCallback(
    (event: ChatEvent) =>
      handleThreadEvent(event, {
        conversationId: conversationRef.current,
        currentUserId,
        dispatch,
        setReads,
        setPresence,
        setMembers,
        setPhotoAlbum: setPhotoAlbumState,
        setAppearance: setAppearanceState,
        setLiveShare,
        noteTyping,
        clearTyping,
        refreshAssistants
      }),
    [currentUserId, noteTyping, clearTyping, setLiveShare, refreshAssistants]
  );

  useChatStream({ onEvent, onResync: load, onStateChange: setConnection });

  useMarkRead(conversationId, lastStoredMessage(state.messages)?.id);

  const { send, retry } = useThreadSend(conversationId, currentUserId, latestState, dispatch);
  const { react, edit, remove, setPhotoAlbum, startCollage, setAppearance, removeFromAlbum, placeInAlbum } =
    useThreadActions(conversationId, dispatch, setPhotoAlbumState, setAppearanceState);

  /** Throttled: typing fires per keystroke, the network should not. */
  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    const now = Date.now();
    if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
    lastTypingSent.current = now;
    void chatApi.sendTyping(conversationId);
  }, [conversationId]);

  const typingNames = useMemo(() => namesTyping(typing, conversationId), [typing, conversationId]);
  const working = useMemo(() => assistantsWorking(typing, conversationId), [typing, conversationId]);

  return {
    messages: state.messages,
    loading: state.loading,
    loadingOlder: state.loadingOlder,
    hasOlder: Boolean(state.nextCursor),
    error: state.error,
    connection,
    typingNames,
    assistantsWorking: working,
    assistants,
    refreshAssistants,
    assistantActions,
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
