import { Request, Response } from 'express';
import { SSE_HEARTBEAT_MS, logger, openSseStream, type SseStream } from '@tumbaland/backend-core';
import { caller } from '../services/accessService';
import { listConversations } from '../services/conversationService';
import { listMessages } from '../services/messageService';
import { touch } from '../services/presenceService';
import { formatEvent, subscribe } from '../services/streamHub';

/**
 * GET /api/chat/stream
 *
 * One long-lived Server-Sent Events connection per open app. Chosen over a
 * WebSocket because `EventSource` with `withCredentials` sends the
 * `.tumbaland.eu` session cookie across subdomains, so it reuses
 * `authenticateToken` untouched, and because reconnection and `Last-Event-ID`
 * resume are the browser's job rather than ours.
 *
 * The stream itself (headers, heartbeat, lifetime, shutdown) is backend-core's
 * `openSseStream`. What is chat's own and not optional is the `Last-Event-ID`
 * replay below. Without it, a message sent during a five-second tunnel drop is
 * never delivered to that client at all, and the thread silently misses it
 * until the page is reloaded.
 */
export const stream = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);

  const sse = openSseStream(res);

  // Only the call listener sends one; it lets a dropped call be told apart from
  // the same person still having another tab open.
  const rawDevice = req.query.deviceId;
  const deviceId = typeof rawDevice === 'string' && rawDevice.length <= 64 ? rawDevice : null;
  const unsubscribe = subscribe(person.id, person.groups, sse, deviceId);
  if (!unsubscribe) {
    // Already at the per-user cap. Answered on the stream rather than as a
    // status code, because the headers are out: the client reads the reason
    // and stops retrying instead of hammering.
    sse.end(
      formatEvent({
        type: 'conversation.updated',
        conversationId: '',
        at: Date.now(),
        payload: { error: 'too_many_streams' }
      })
    );
    return;
  }

  // Tells the client the stream is live, and how often to expect a heartbeat so
  // it can declare the connection dead without waiting for a TCP timeout. iOS
  // suspends a backgrounded EventSource without closing it, so a client that
  // waits for an error event waits forever.
  sse.send(
    formatEvent({
      type: 'conversation.updated',
      conversationId: '',
      at: Date.now(),
      payload: { ready: true, heartbeatMs: SSE_HEARTBEAT_MS }
    })
  );

  sse.onClose(() => {
    unsubscribe();
    // Leaving counts as the last sign of life, so "Active now" lingers for the
    // short window rather than the time since the stream opened.
    void touch(person);
  });

  void touch(person);

  // Install cleanup before any I/O: a phone can disappear during replay.
  await replayMissed(req, sse, person);
};

/**
 * Replays anything that happened while this client was disconnected.
 *
 * `Last-Event-ID` is set by the browser automatically on reconnect from the
 * last `id:` it saw, so this needs nothing from the client. The window is
 * capped at five minutes: past that the client is better off refetching the
 * thread than being handed a thousand events.
 */
const MAX_REPLAY_MS = 5 * 60 * 1000;

async function replayMissed(
  req: Request,
  sse: SseStream,
  person: ReturnType<typeof caller>
): Promise<void> {
  const header = req.header('Last-Event-ID') ?? (req.query.lastEventId as string | undefined);
  if (!header) return;

  const since = Number(header);
  if (!Number.isFinite(since) || since <= 0) return;
  if (Date.now() - since > MAX_REPLAY_MS) return;

  try {
    const reachable = await listConversations(person);
    for (const conversation of reachable) {
      if (sse.closed) return;
      const page = await listMessages(conversation.id, { after: new Date(since).toISOString(), limit: 100 });
      // listMessages returns newest first; replay in the order they happened.
      for (const message of [...page.messages].reverse()) {
        if (sse.closed) return;
        sse.send(
          formatEvent({
            type: 'message.created',
            conversationId: conversation.id,
            at: new Date(message.createdAt).getTime(),
            payload: message
          })
        );
      }
    }
  } catch (error) {
    // A failed replay must not take the stream down with it: the client is
    // connected and live events still work. It will refetch on next focus.
    logger.warn('Chat stream replay failed', { error: (error as Error).message });
  }
}
