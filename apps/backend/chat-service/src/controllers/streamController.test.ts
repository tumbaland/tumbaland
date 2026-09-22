import { Request, Response } from 'express';
import { stream } from './streamController';
import { MAX_STREAMS_PER_USER, clearSubscribers, openStreamCount, publishToGroup } from '../services/streamHub';

jest.mock('../services/conversationService', () => ({
  listConversations: jest.fn(async () => [])
}));
jest.mock('../services/messageService', () => ({
  listMessages: jest.fn(async () => ({ messages: [], nextCursor: null }))
}));
const touch = jest.fn(async () => undefined);
jest.mock('../services/presenceService', () => ({ touch: (...args: unknown[]) => touch(...(args as [])) }));

import { listConversations } from '../services/conversationService';
import { listMessages } from '../services/messageService';

const USER = { id: 'u1', email: 'tom@example.com', name: 'Tom' };

/** A request with an authenticated user and the close/error hooks the handler wires. */
function fakeReq(headers: Record<string, string> = {}, query: Record<string, string> = {}) {
  const handlers = new Map<string, () => void>();
  return {
    user: USER,
    userGroups: ['g1'],
    query,
    header: (name: string) => headers[name],
    on: (event: string, handler: () => void) => handlers.set(event, handler),
    fire: (event: string) => handlers.get(event)?.(),
    has: (event: string) => handlers.has(event)
  };
}

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

const run = (req: ReturnType<typeof fakeReq>, res: ReturnType<typeof fakeRes>) =>
  stream(req as unknown as Request, res as unknown as Response);

beforeEach(() => {
  jest.useFakeTimers();
  clearSubscribers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  clearSubscribers();
  jest.clearAllMocks();
});

describe('SSE headers', () => {
  it('sets the event-stream content type and disables proxy buffering', async () => {
    const res = fakeRes();
    await run(fakeReq(), res);

    expect(res.status).toBe(200);
    expect(res.headers['Content-Type']).toContain('text/event-stream');
    expect(res.headers['Cache-Control']).toContain('no-cache');
    // Without this nginx buffers the response and the client sees an open
    // connection that never delivers anything.
    expect(res.headers['X-Accel-Buffering']).toBe('no');
  });

  it('flushes the headers immediately rather than waiting for the first event', async () => {
    const res = fakeRes();
    await run(fakeReq(), res);

    expect(res.flushed).toBe(true);
  });

  it('announces itself ready and says how often a heartbeat is due', async () => {
    const res = fakeRes();
    await run(fakeReq(), res);

    const payload = JSON.parse(res.written[0]!.split('data: ')[1]!.trim()).payload;
    expect(payload.ready).toBe(true);
    expect(payload.heartbeatMs).toBeGreaterThan(0);
  });
});

describe('subscription lifecycle', () => {
  it('registers the stream so a publish reaches it', async () => {
    const res = fakeRes();
    await run(fakeReq(), res);
    const before = res.written.length;

    publishToGroup('g1', { type: 'message.created', conversationId: 'c1', at: 1, payload: { id: 'm1' } });

    expect(res.written.length).toBe(before + 1);
    expect(res.written.at(-1)).toContain('event: message.created');
  });

  it('unsubscribes when the client goes away', async () => {
    const req = fakeReq();
    await run(req, fakeRes());
    expect(openStreamCount()).toBe(1);

    req.fire('close');

    expect(openStreamCount()).toBe(0);
  });

  it('unsubscribes if the phone disconnects while replay is still loading', async () => {
    let finish!: (rows: unknown[]) => void;
    (listConversations as jest.Mock).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const req = fakeReq({ 'Last-Event-ID': String(Date.now() - 1000) });
    const pending = run(req, fakeRes());
    req.fire('close');
    expect(openStreamCount()).toBe(0);
    finish([]);
    await pending;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('sends a heartbeat event the browser watchdog can observe', async () => {
    const res = fakeRes();
    await run(fakeReq(), res);
    const before = res.written.length;

    jest.advanceTimersByTime(25_000);

    expect(res.written.slice(before).join('')).toBe('event: heartbeat\ndata: {}\n\n');
  });

  it('stops the heartbeat once the client disconnects', async () => {
    const req = fakeReq();
    const res = fakeRes();
    await run(req, res);
    req.fire('close');
    const before = res.written.length;

    jest.advanceTimersByTime(100_000);

    expect(res.written.length).toBe(before);
  });

  it('refuses past the per-user cap and closes the response', async () => {
    for (let i = 0; i < MAX_STREAMS_PER_USER; i++) await run(fakeReq(), fakeRes());

    const res = fakeRes();
    await expect(run(fakeReq(), res)).resolves.toBeUndefined();

    expect(res.ended).toBe(true);
    expect(res.written.join('')).toContain('too_many_streams');
  });

  it('unsubscribes when the response closes', async () => {
    const req = fakeReq();
    const res = fakeRes();
    await run(req, res);
    expect(openStreamCount()).toBe(1);

    res.fire('close');

    expect(openStreamCount()).toBe(0);
  });
});

describe('Last-Event-ID replay', () => {
  it('replays messages that arrived while the client was disconnected', async () => {
    (listConversations as jest.Mock).mockResolvedValue([{ id: 'c1' }]);
    (listMessages as jest.Mock).mockResolvedValue({
      messages: [
        { id: 'm2', createdAt: new Date(2_000).toISOString() },
        { id: 'm1', createdAt: new Date(1_000).toISOString() }
      ],
      nextCursor: null
    });

    const res = fakeRes();
    await run(fakeReq({ 'Last-Event-ID': String(Date.now() - 10_000) }), res);

    const replayed = res.written.filter((frame) => frame.includes('event: message.created'));
    expect(replayed).toHaveLength(2);
    // listMessages returns newest first; the stream must replay oldest first or
    // the thread renders backwards.
    expect(replayed[0]).toContain('"id":"m1"');
    expect(replayed[1]).toContain('"id":"m2"');
  });

  it('accepts the id from a query parameter, for clients that cannot set headers', async () => {
    (listConversations as jest.Mock).mockResolvedValue([{ id: 'c1' }]);
    (listMessages as jest.Mock).mockResolvedValue({
      messages: [{ id: 'm1', createdAt: new Date(1_000).toISOString() }],
      nextCursor: null
    });

    const res = fakeRes();
    await run(fakeReq({}, { lastEventId: String(Date.now() - 10_000) }), res);

    expect(res.written.some((frame) => frame.includes('"id":"m1"'))).toBe(true);
  });

  it('skips the replay entirely with no Last-Event-ID', async () => {
    await run(fakeReq(), fakeRes());

    expect(listConversations).not.toHaveBeenCalled();
  });

  it.each([['not-a-number'], ['0'], ['-5']])('ignores a nonsense id (%s)', async (value) => {
    await run(fakeReq({ 'Last-Event-ID': value }), fakeRes());

    expect(listConversations).not.toHaveBeenCalled();
  });

  it('refuses to replay a window older than the cap, so a stale client is not flooded', async () => {
    await run(fakeReq({ 'Last-Event-ID': String(Date.now() - 60 * 60 * 1000) }), fakeRes());

    expect(listConversations).not.toHaveBeenCalled();
  });

  it('keeps the stream alive when the replay itself fails', async () => {
    (listConversations as jest.Mock).mockRejectedValue(new Error('database gone'));

    const res = fakeRes();
    await expect(run(fakeReq({ 'Last-Event-ID': String(Date.now() - 10_000) }), res)).resolves.toBeUndefined();

    // Still subscribed: live events work even though the backfill did not.
    expect(openStreamCount()).toBe(1);
  });
});

describe('presence', () => {
  it('counts opening and closing a stream as signs of life', async () => {
    touch.mockClear();
    const req = fakeReq();
    const res = fakeRes();

    await stream(req as unknown as Request, res as unknown as Response);
    expect(touch).toHaveBeenCalledTimes(1);

    req.fire('close');
    expect(touch).toHaveBeenCalledTimes(2);
  });
});
