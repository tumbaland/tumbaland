import { useCallback, useRef, type Dispatch, type MutableRefObject } from 'react';
import { logger } from '@tumbaland/frontend-core';
import { chatApi, newClientId } from '../services/chatApi';
import { messageSummary } from '../services/summary';
import type { ThreadAction, ThreadState } from './threadReducer';
import type { Attachment, Quote, SendOptions } from '../types';

/**
 * Sending, and sending again. A message is shown at once as pending and
 * replaced by the server's copy; one that fails stays, marked, until retried.
 */
export function useThreadSend(
  conversationId: string | undefined,
  currentUserId: string,
  latestState: MutableRefObject<ThreadState>,
  dispatch: Dispatch<ThreadAction>
) {
  /** Bodies kept by clientId so a failed send can be retried unchanged. */
  const outbox = useRef(
    new Map<string, { body: string; attachments: Attachment[]; options: SendOptions; quote: Quote | null }>()
  );

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
    [conversationId, dispatch]
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
    [conversationId, currentUserId, deliver, latestState, dispatch]
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
    [conversationId, currentUserId, deliver, dispatch]
  );

  return { send, retry };
}
