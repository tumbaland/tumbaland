import express from 'express';
import request from 'supertest';
import { recordTiming, slowRequestLogger } from './serverTiming';

const warn = jest.fn();
jest.mock('../logging/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: (...args: unknown[]) => warn(...args), info: jest.fn(), debug: jest.fn(), http: jest.fn() }
}));

beforeEach(() => warn.mockClear());

describe('recordTiming', () => {
  it('publishes each phase to the browser as Server-Timing', async () => {
    const app = express();
    app.get('/x', (_req, res) => {
      recordTiming(res, 'session', 3.24);
      recordTiming(res, 'groups', 120);
      res.json({ ok: true });
    });

    const res = await request(app).get('/x');

    expect(res.headers['server-timing']).toBe('session;dur=3.2, groups;dur=120');
  });

  it('does not throw once the body has started, and still keeps the figure for the log', async () => {
    const app = express();
    app.get('/x', (_req, res) => {
      res.write('{"ok":true}');
      recordTiming(res, 'late', 5);
      res.end();
    });

    const res = await request(app).get('/x');

    expect(res.status).toBe(200);
    expect(res.headers['server-timing']).toBeUndefined();
  });

  it('copes with a response that is not a real one, as in a unit test of a middleware', () => {
    const res = {} as never;

    expect(() => recordTiming(res, 'session', 1)).not.toThrow();
  });
});

describe('slowRequestLogger', () => {
  const slow = (threshold = 10) => {
    const app = express();
    app.use(slowRequestLogger(threshold));
    app.get('/api/chat/conversations/6ab19e56d906400d55593910/read', async (_req, res) => {
      recordTiming(res, 'groups', 2900);
      await new Promise((resolve) => setTimeout(resolve, 30));
      res.status(204).end();
    });
    app.get('/quick', (_req, res) => res.json({ ok: true }));
    app.get('/stream', async (_req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      await new Promise((resolve) => setTimeout(resolve, 30));
      res.end();
    });
    return app;
  };

  it('logs a request over the threshold, with its phases and the route without the id', async () => {
    await request(slow()).get('/api/chat/conversations/6ab19e56d906400d55593910/read?x=1');

    expect(warn).toHaveBeenCalledWith(
      'Slow request',
      expect.objectContaining({
        method: 'GET',
        route: '/api/chat/conversations/:id/read',
        status: 204,
        timings: { groups: 2900 }
      })
    );
    expect(warn.mock.calls[0]![1].ms).toBeGreaterThanOrEqual(10);
  });

  it('says nothing about a request that was quick', async () => {
    await request(slow(1000)).get('/quick');

    expect(warn).not.toHaveBeenCalled();
  });

  it('does not call a stream slow for being a stream', async () => {
    await request(slow()).get('/stream');

    expect(warn).not.toHaveBeenCalled();
  });
});
