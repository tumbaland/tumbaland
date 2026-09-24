jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

import type { Response } from 'express';
import {
  SSE_HEARTBEAT_MS,
  SSE_MAX_STREAM_AGE_MS,
  closeAllSseStreams,
  formatSseFrame,
  openSseStream,
  openSseStreamCount
} from './sseStream';

/** Just enough of a Response: headers, writes, the end, and its close hooks. */
function fakeRes() {
  const handlers = new Map<string, () => void>();
  return {
    status: 0,
    headers: {} as Record<string, string>,
    written: [] as string[],
    flushed: false,
    ended: false,
    writeHead(status: number, headers: Record<string, string>) {
      this.status = status;
      this.headers = headers;
      return this;
    },
    flushHeaders() {
      this.flushed = true;
    },
    write(chunk: string) {
      this.written.push(chunk);
      return true;
    },
    end() {
      this.ended = true;
    },
    on: (event: string, handler: () => void) => handlers.set(event, handler),
    fire: (event: string) => handlers.get(event)?.()
  };
}

const open = (res: ReturnType<typeof fakeRes>, options?: Parameters<typeof openSseStream>[1]) =>
  openSseStream(res as unknown as Response, options);

beforeEach(() => jest.useFakeTimers());

afterEach(() => {
  closeAllSseStreams();
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('formatSseFrame', () => {
  it('emits event and data lines terminated by a blank line', () => {
    expect(formatSseFrame('ready', { ok: true })).toBe('event: ready\ndata: {"ok":true}\n\n');
  });

  it('leads with an id line when given one, so a reconnect can resume', () => {
    expect(formatSseFrame('typing', {}, 1700)).toBe('id: 1700\nevent: typing\ndata: {}\n\n');
  });
});

describe('openSseStream', () => {
  it('sends event-stream headers that stop proxy buffering, and flushes them at once', () => {
    const res = fakeRes();
    open(res);

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/event-stream');
    expect(res.headers['Cache-Control']).toContain('no-cache');
    expect(res.headers['X-Accel-Buffering']).toBe('no');
    expect(res.flushed).toBe(true);
    expect(openSseStreamCount()).toBe(1);
  });

  it('sends a heartbeat event the browser watchdog can see', () => {
    const res = fakeRes();
    open(res);

    jest.advanceTimersByTime(SSE_HEARTBEAT_MS);

    expect(res.written).toEqual(['event: heartbeat\ndata: {}\n\n']);
  });

  it('recycles the stream at its maximum age, telling the browser to reconnect', () => {
    const res = fakeRes();
    const onClose = jest.fn();
    open(res).onClose(onClose);

    jest.advanceTimersByTime(SSE_MAX_STREAM_AGE_MS);

    expect(res.written.at(-1)).toBe('retry: 1000\n\n');
    expect(res.ended).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openSseStreamCount()).toBe(0);
  });

  it('takes its timings from the options', () => {
    const res = fakeRes();
    open(res, { heartbeatMs: 10, maxAgeMs: 35 });

    jest.advanceTimersByTime(35);

    expect(res.written.filter((frame) => frame.includes('heartbeat'))).toHaveLength(3);
    expect(res.ended).toBe(true);
  });

  it.each(['close', 'error'])('cleans up once when the response reports %s', (event) => {
    const res = fakeRes();
    const onClose = jest.fn();
    const stream = open(res);
    stream.onClose(onClose);

    res.fire(event);
    res.fire(event);
    jest.advanceTimersByTime(SSE_MAX_STREAM_AGE_MS);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stream.closed).toBe(true);
    // No heartbeat into a closed socket.
    expect(res.written).toEqual([]);
  });

  it('runs a close handler at once when the stream has already closed', () => {
    const stream = open(fakeRes());
    stream.end();
    const onClose = jest.fn();

    stream.onClose(onClose);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs every close handler even when one throws', () => {
    const stream = open(fakeRes());
    const second = jest.fn();
    stream.onClose(() => {
      throw new Error('boom');
    });
    stream.onClose(second);

    stream.end();

    expect(second).toHaveBeenCalled();
  });
});

describe('send', () => {
  it('writes a frame and says so', () => {
    const res = fakeRes();
    const stream = open(res);

    expect(stream.send('event: x\ndata: {}\n\n')).toBe(true);
    expect(res.written).toEqual(['event: x\ndata: {}\n\n']);
  });

  it('closes the stream when a write throws, and writes nothing more', () => {
    const res = fakeRes();
    res.write = () => {
      throw new Error('socket hang up');
    };
    const stream = open(res);
    const onClose = jest.fn();
    stream.onClose(onClose);

    expect(stream.send('event: x\ndata: {}\n\n')).toBe(false);
    expect(onClose).toHaveBeenCalled();
    expect(stream.send('event: y\ndata: {}\n\n')).toBe(false);
    expect(openSseStreamCount()).toBe(0);
  });
});

describe('end', () => {
  it('sends a last frame before ending, for a refusal the client can read', () => {
    const res = fakeRes();
    open(res).end('event: ready\ndata: {"error":"full"}\n\n');

    expect(res.written).toEqual(['event: ready\ndata: {"error":"full"}\n\n']);
    expect(res.ended).toBe(true);
  });

  it('survives a socket that throws on the way out', () => {
    const res = fakeRes();
    res.end = () => {
      throw new Error('already destroyed');
    };
    const stream = open(res);

    expect(() => stream.end()).not.toThrow();
    expect(stream.closed).toBe(true);
  });
});

describe('closeAllSseStreams', () => {
  it('ends every stream with a retry hint and runs their cleanup', () => {
    const first = fakeRes();
    const second = fakeRes();
    const onClose = jest.fn();
    open(first).onClose(onClose);
    open(second).onClose(onClose);

    closeAllSseStreams();

    for (const res of [first, second]) {
      expect(res.ended).toBe(true);
      expect(res.written.join('')).toContain('retry: 2000');
    }
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(openSseStreamCount()).toBe(0);
  });
});
