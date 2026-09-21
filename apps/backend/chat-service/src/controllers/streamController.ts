import { Request, Response } from 'express';
import { logger } from '@tumbaland/backend-core';
import { caller } from '../services/accessService';
import { listConversations } from '../services/conversationService';
import { listMessages } from '../services/messageService';
import { HEARTBEAT_MS, MAX_STREAM_AGE_MS, formatEvent, subscribe } from '../services/streamHub';

/**
 * GET /api/chat/stream
 *
 * One long-lived Server-Sent Events connection per open app. Chosen over a
 * WebSocket because `EventSource` with `withCredentials` sends the
 * `.tumbaland.eu` session cookie across subdomains, so it reuses
 * `authenticateToken` untouched, and because reconnection and `Last-Event-ID`
 * resume are the browser's job rather than ours.
 *
 * Three things here are not optional:
 *
 * - `X-Accel-Buffering: no` plus `flushHeaders()`. Without them nginx holds the
 *   response in its buffer and the client sees an open connection that never
 *   delivers anything, which looks exactly like a broken server.
 * - The heartbeat. The proxy closes an idle connection at `proxy_read_timeout`,
 *   and a client reconnecting every time looks like a reconnect loop.
 * - The `Last-Event-ID` replay below. Without it, a message sent during a
 *   five-second tunnel drop is never delivered to that client at all, and the
 *   thread silently misses it until the page is reloaded.
 */
export const stream = async (req: Request, res: Response): Promise<void> => {
  const person = caller(req);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // nginx buffers proxied responses by default, which breaks SSE entirely.
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  const unsubscribe = subscribe(person.id, person.groups, res);
  if (!unsubscribe) {
    // Already at the per-user cap. Answered on the stream rather than as a
    // status code, because the headers are out: the client reads the reason
    // and stops retrying instead of hammering.
    res.write(
      formatEvent({
        type: 'conversation.updated',
        conversationId: '',
        at: Date.now(),
        payload: { error: 'too_many_streams' }
      })
    );
    res.end();
    return;
  }

  // Tells the client the stream is live, and how often to expect a heartbeat so
  // it can declare the connection dead without waiting for a TCP timeout. iOS
  // suspends a backgrounded EventSource without closing it, so a client that
  // waits for an error event waits forever.
  res.write(
    formatEvent({
      type: 'conversation.updated',
      conversationId: '',
      at: Date.now(),
      payload: { ready: true, heartbeatMs: HEARTBEAT_MS }
    })
  );

  await replayMissed(req, res, person);

  const heartbeat = setInterval(() => {
    // A comment line: valid SSE, ignored by EventSource, keeps the proxy from
    // closing the connection.
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, HEARTBEAT_MS);

  /**
   * A stream carries the group membership it authenticated with for its whole
   * life, and membership is re-read on every ordinary request. Recycling the
   * connection bounds how long a removed group member could keep receiving
   * messages; EventSource reconnects on its own, so the client sees nothing.
   */
  const recycle = setTimeout(() => {
    try {
      res.write('retry: 1000\n\n');
      res.end();
    } catch {
      // Already gone.
    }
  }, MAX_STREAM_AGE_MS);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(recycle);
    unsubscribe();
  };

  req.on('close', close);
  res.on('close', close);
  res.on('error', close);
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
  res: Response,
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
      const page = await listMessages(conversation.id, { after: new Date(since).toISOString(), limit: 100 });
      // listMessages returns newest first; replay in the order they happened.
      for (const message of [...page.messages].reverse()) {
        res.write(
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
