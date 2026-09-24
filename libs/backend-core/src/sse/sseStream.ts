import type { Response } from 'express';
import logger from '../logging/logger';

/**
 * The plumbing of a Server-Sent Events response: headers, heartbeat, a bounded
 * lifetime, cleanup when the client goes, and closing everything at shutdown.
 * What goes down the stream, and to whom, stays with the service.
 *
 * Three things here are not optional:
 *
 * - `X-Accel-Buffering: no` plus `flushHeaders()`. Without them nginx holds the
 *   response in its buffer and the client sees an open connection that never
 *   delivers anything, which looks exactly like a broken server.
 * - The heartbeat. The proxy closes an idle connection at `proxy_read_timeout`,
 *   and a client reconnecting every time looks like a reconnect loop.
 * - The lifetime. Access is checked when a stream opens, and a stream carries
 *   that answer for as long as it runs. Recycling it bounds how long someone
 *   taken out of a group could keep receiving; EventSource reconnects on its
 *   own, re-authenticates, and the client sees nothing.
 */

/**
 * Heartbeat interval. A named event rather than a comment line: comments are
 * invisible to browser JavaScript, and the client's watchdog needs to see it.
 * iOS suspends a backgrounded EventSource without closing it, so a client that
 * waits for an error event waits forever.
 */
export const SSE_HEARTBEAT_MS = 25_000;

/** How long one stream runs before the server closes it and the client reconnects. */
export const SSE_MAX_STREAM_AGE_MS = 30 * 60 * 1000;

const HEARTBEAT_FRAME = 'event: heartbeat\ndata: {}\n\n';

export interface SseStream {
  /** Writes a frame. False once the stream is closed, or if the write failed (which closes it). */
  send(frame: string): boolean;
  /** Ends the response, after one last frame if given. */
  end(lastFrame?: string): void;
  /** Runs once when the stream closes, for whatever reason. At once if it already has. */
  onClose(handler: () => void): void;
  readonly closed: boolean;
}

export interface OpenSseStreamOptions {
  heartbeatMs?: number;
  maxAgeMs?: number;
}

/** Serialises one event in the SSE wire format. */
export function formatSseFrame(event: string, data: unknown, id?: string | number): string {
  const idLine = id === undefined ? '' : `id: ${id}\n`;
  return `${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const open = new Set<SseStream>();

/**
 * Turns a response into an event stream. Check access before calling it: once
 * the headers are out, an error can no longer be a status code, only a frame.
 */
export function openSseStream(res: Response, options: OpenSseStreamOptions = {}): SseStream {
  const { heartbeatMs = SSE_HEARTBEAT_MS, maxAgeMs = SSE_MAX_STREAM_AGE_MS } = options;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders?.();

  let closed = false;
  const handlers: Array<() => void> = [];

  const runHandler = (handler: () => void): void => {
    try {
      handler();
    } catch (error) {
      // One failing cleanup must not skip the others.
      logger.warn('SSE close handler failed', { error: (error as Error).message });
    }
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    clearTimeout(recycle);
    open.delete(stream);
    for (const handler of handlers.splice(0)) runHandler(handler);
  };

  const send = (frame: string): boolean => {
    if (closed) return false;
    try {
      res.write(frame);
      return true;
    } catch (error) {
      // A half-closed socket throws rather than returning an error.
      logger.warn('Closing SSE stream after a failed write', { error: (error as Error).message });
      close();
      return false;
    }
  };

  const end = (lastFrame?: string): void => {
    if (closed) return;
    if (lastFrame) send(lastFrame);
    try {
      res.end();
    } catch {
      // Already gone.
    }
    close();
  };

  const heartbeat = setInterval(() => send(HEARTBEAT_FRAME), heartbeatMs);
  // `retry:` tells the browser how soon to reconnect.
  const recycle = setTimeout(() => end('retry: 1000\n\n'), maxAgeMs);

  const stream: SseStream = {
    send,
    end,
    onClose(handler) {
      if (closed) runHandler(handler);
      else handlers.push(handler);
    },
    get closed() {
      return closed;
    }
  };
  open.add(stream);

  // The response, not the request: a GET's request side can report closed as
  // soon as its empty body has been read.
  res.on('close', close);
  res.on('error', close);

  return stream;
}

/** Open stream count, for `/metrics` and tests. */
export function openSseStreamCount(): number {
  return open.size;
}

/**
 * Ends every open stream, for shutdown. `server.close()` waits for in-flight
 * responses and an event stream never finishes by itself, so without this a
 * rollout times out and force-exits. The browsers reconnect to the new
 * container on their own. `registerShutdown` calls it.
 */
export function closeAllSseStreams(): void {
  for (const stream of [...open]) stream.end('retry: 2000\n\n');
}
